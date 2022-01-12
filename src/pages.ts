import MagicString, { Bundle as MagicBundle } from 'magic-string'
import md5Hex from 'md5-hex'
import path from 'path'
import { ssrRequire } from './bundle/ssrModules'
import { withCache } from './client/withCache'
import type {
  BeforeRenderHook,
  Client,
  ClientDescription,
  ClientFunction,
  ClientFunctions,
  ClientState,
  Renderer,
  RenderFunction,
  RenderModule,
  RenderRequest,
  Route,
  RouteInclude,
  RouteParams,
  RoutesModule,
  RuntimeConfig,
  SausContext,
  StateModule,
} from './core'
import { debug } from './core/debug'
import { mergeHtmlProcessors } from './core/html'
import { matchRoute } from './core/routes'
import { isStateModule } from './core/stateModules'
import { defer } from './utils/defer'
import { serializeImports } from './utils/imports'
import { noop } from './utils/noop'
import { ParsedUrl, parseUrl } from './utils/url'

/**
 * Get the `.html` filename for a given URL pathname.
 *
 * Beware: Trailing slashes are treated as `/index.html` and querystrings
 * are not supported.
 */
export function getPageFilename(path: string, basePath?: string) {
  if (basePath && path == basePath.slice(0, -1)) {
    return basePath.slice(1) + 'index.html'
  }
  return path.slice(1) + (path.endsWith('/') ? 'index.html' : '.html')
}

export type PageFactory = ReturnType<typeof createPageFactory>

export type RenderedPage = {
  path: string
  html: string
  state?: ClientState
  client?: Client
  stateModules: string[]
  routeModuleId: string
}

type SausContextKeys =
  | 'basePath'
  | 'defaultPath'
  | 'pages'
  | 'loadingStateCache'
  | 'loadedStateCache'

export interface PageFactoryContext
  extends Pick<SausContext, SausContextKeys>,
    RoutesModule,
    RenderModule {
  logger: { warn(msg: string): void; error(msg: string): void }
}

interface PageState extends ClientState {
  /** The IDs of any state modules needed by this page. */
  $: string[] | undefined
}

export function createPageFactory(
  context: PageFactoryContext,
  functions: ClientFunctions,
  config?: RuntimeConfig,
  setup?: () => Promise<any>
) {
  let {
    pages,
    loadingStateCache,
    loadedStateCache,
    routes,
    renderers,
    defaultState,
    defaultRoute,
    defaultRenderer,
    beforeRenderHooks,
    processHtml,
    basePath,
    logger,
  } = context

  const resolveState = withCache<PageState>(loadingStateCache, loadedStateCache)

  const loadStateModule = (
    loaded: Map<string, Promise<any>>,
    state: StateModule
  ) => {
    let loading = loaded.get(state.id)
    if (!loading) {
      loading = resolveState(state.id, state.load)
      loaded.set(state.id, loading)
    }
    return loading
  }

  const loadStateModules = (
    loaded: Map<string, Promise<any>>,
    include: RouteInclude,
    url: ParsedUrl,
    params: RouteParams
  ) => {
    const included =
      typeof include == 'function' ? include(url, params) : include
    return included.map(loadStateModule.bind(null, loaded))
  }

  const getPageState = (url: ParsedUrl, params: RouteParams, route: Route) =>
    resolveState(url.path, async () => {
      let pageState: PageState

      // State modules start loading before the root-level state is awaited.
      const pendingStateModules = new Map<string, Promise<any>>()
      for (const include of defaultState.concat(route.include || [])) {
        loadStateModules(pendingStateModules, include, url, params)
      }

      if (route.state) {
        pageState = (await route.state(
          Object.values(params),
          url.searchParams
        )) as any

        // Load any embedded state modules.
        JSON.stringify(pageState, (key, state) => {
          if (!isStateModule(state)) {
            return state
          }
          loadStateModule(pendingStateModules, state)
          pageState[key] = { '@import': '/' + state.id + '.js' }
        })
      } else {
        pageState = {} as any
      }

      if (pendingStateModules.size) {
        await Promise.all(pendingStateModules.values())
        pageState.$ = Array.from(pendingStateModules.keys())
      }

      pageState.routePath = route.path
      pageState.routeParams = params
      return pageState
    })

  // Pages cannot be rendered in parallel, or else we risk inconsistencies
  // caused by global state mutation.
  let renderQueue: Promise<void>

  if (config) {
    renderQueue = (async () => {
      if (setup) {
        await setup()
      }
      context.runtimeHooks.forEach(onSetup => {
        onSetup(config)
      })
      if (context.htmlProcessors) {
        processHtml = mergeHtmlProcessors(
          context.htmlProcessors,
          page => ({ page, config }),
          ['pre', 'default']
        )
      }
      routes = [...context.routes].reverse()
      renderers = [...context.renderers].reverse()
      defaultRoute = context.defaultRoute
      defaultRenderer = context.defaultRenderer
    })()
  } else {
    routes = [...routes].reverse()
    renderers = [...renderers].reverse()
    renderQueue = Promise.resolve()
  }

  // For mapping a pathname to its route
  const routeMap: Record<string, Route | undefined> = {}

  const warnings = new Set<string>()
  const warn = (msg: string) => {
    if (!warnings.has(msg)) {
      warnings.add(msg)
      logger.warn(msg)
    }
  }

  // The main logic for rendering a page.
  async function renderPage(
    url: ParsedUrl,
    state: PageState,
    route: Route,
    renderer: Renderer
  ): Promise<RenderedPage | null> {
    const stateModules = state.$ || []
    delete state.$

    const { path } = url
    const request: RenderRequest = {
      path,
      query: url.search,
      params: state.routeParams,
      state,
    }

    debug(`Loading route: ${route.moduleId}`)
    const routeModule = await route.load()

    if (beforeRenderHooks.length) {
      debug(`Running beforeRender hooks`)
    }

    const usedHooks: BeforeRenderHook[] = []
    for (const hook of beforeRenderHooks) {
      if (!hook.test || hook.test(path)) {
        usedHooks.push(hook)
        await hook(request)
      }
    }

    debug(`Rendering page: ${path}`)
    let html = await renderer.render(routeModule, request, renderer)
    if (html == null) {
      debug(`Nothing was rendered. Trying next renderer.`)
      return null
    }

    const filename = getPageFilename(path, basePath)

    let client = pages[filename]?.client
    if (!client) {
      debug(`Generating client module`)
      client = await getClient(functions, renderer, usedHooks)
    }

    const page: RenderedPage = {
      path,
      html,
      state,
      client,
      stateModules,
      routeModuleId: route.moduleId,
    }

    if (processHtml) {
      page.html = await processHtml(page.html, page)
    }

    debug(`Page ready: ${path}`)

    // Currently, the page cache is only used by the saus:client plugin,
    // since the performance impact of rendering on every request isn't
    // bad enough to justify complicated cache invalidation.
    return (pages[filename] = page)
  }

  /**
   * Use the default renderer to render HTML for the given `url`.
   * If the given `route` is undefined, nothing is rendered.
   */
  function renderDefaultPage(url: ParsedUrl, state: PageState, route: Route) {
    if (defaultRenderer) {
      return renderPage(url, state, route, defaultRenderer)
    }
    warn('Default renderer is not defined')
    return null
  }

  async function renderUnknownPage(url: ParsedUrl, params: RouteParams = {}) {
    if (!defaultRoute) {
      return null
    }
    const state = await getPageState(url, params, defaultRoute)
    return renderDefaultPage(url, state, defaultRoute)
  }

  async function renderRoute(
    url: ParsedUrl,
    params: RouteParams,
    route: Route
  ) {
    const state = await getPageState(url, params, route)
    for (const renderer of renderers) {
      if (renderer.test(url.path)) {
        const page = await renderPage(url, state, route, renderer)
        if (page) {
          return page
        }
      }
    }
    return renderDefaultPage(url, state, route)
  }

  // For reuse of pending `renderPage` calls
  const pendingPagePromises = new Map<string, Promise<RenderedPage | null>>()

  const resolvePage = (
    url: string | ParsedUrl,
    renderPage: (url: ParsedUrl) => Promise<RenderedPage | null>
  ) => {
    if (typeof url == 'string') {
      url = parseUrl(url)
    }
    let pagePath = url.path
    let pagePromise = pendingPagePromises.get(pagePath)
    if (!pagePromise) {
      debug(`Page queued: ${url}`)
      pagePromise = renderQueue
        .then(() => {
          debug(`Page next up: ${url}`)
          return renderPage(url as ParsedUrl)
        })
        .finally(() => {
          pendingPagePromises.delete(pagePath)
        })

      pendingPagePromises.set(pagePath, pagePromise)
      renderQueue = pagePromise.then(noop, noop)
    }
    return pagePromise
  }

  return {
    /**
     * Use the default route to render HTML for the given `url`.
     */
    renderUnknownPage: async (url: string | ParsedUrl, params?: RouteParams) =>
      resolvePage(url, url => renderUnknownPage(url, params)),
    /**
     * Skip route matching and render HTML for the given `url` using
     * the given route and params.
     */
    renderRoute: (url: string | ParsedUrl, params: RouteParams, route: Route) =>
      resolvePage(url, url => renderRoute(url, params, route)),
    /**
     * Find a matching route to render HTML for the given `url`.
     */
    render: (url: string | ParsedUrl) =>
      resolvePage(url, async url => {
        if (typeof url == 'string') {
          url = parseUrl(url)
        }

        let route: Route | undefined
        let error: any

        try {
          route = routeMap[url.path]
          if (route) {
            const params = matchRoute(url.path, route)!
            return await renderRoute(url, params, route)
          }
          for (route of routes) {
            const params = matchRoute(url.path, route)
            if (params) {
              routeMap[url.path] = route
              return await renderRoute(url, params, route)
            }
          }
        } catch (e: any) {
          error = e
        }

        // Skip requests with file extension, unless explicitly
        // handled by a non-default renderer.
        if (!error && /\.[^/]+$/.test(url.path)) {
          return null
        }

        // Render the fallback page.
        if (defaultRenderer && defaultRoute) {
          return await renderUnknownPage(url, { error })
        }

        if (error) {
          throw error
        }
        return null
      }),
    /**
     * Get the client state for the given URL.
     */
    async getState(url: string | ParsedUrl): Promise<ClientState | undefined> {
      if (typeof url == 'string') {
        url = parseUrl(url)
      }

      // Direct access of a state module.
      if (url.path.endsWith('.js')) {
        const stateModule = await resolveState(url.path.slice(1, -3))
        if (stateModule) {
          return stateModule
        }
      }

      let params: RouteParams | undefined
      let route = (routeMap[url.path] ||= routes.find(
        route => (params = matchRoute((url as ParsedUrl).path, route))
      ))

      if (!route && (route = defaultRoute)) {
        params = matchRoute(url.path, route)!
      }

      if (route) {
        return getPageState(url, params!, route)
      }
    },
  }
}

async function getClient(
  functions: ClientFunctions,
  { client, start }: Renderer,
  usedHooks: BeforeRenderHook[]
): Promise<Client | undefined> {
  if (client) {
    const result = renderClient(
      client,
      functions.render.find(fn => fn.start === start)!,
      functions.beforeRender.filter(fn =>
        usedHooks.some(usedHook => fn.start === usedHook.start)
      )
    )
    const hash = md5Hex(result.code).slice(0, 8)
    const ext = path.extname(functions.filename)
    return {
      id: `client.${hash}${ext}`,
      ...result,
    }
  }
}

function renderClient(
  client: ClientDescription,
  renderFn: RenderFunction,
  beforeRenderFns?: ClientFunction[]
) {
  const script = new MagicBundle()
  const imports = [
    `import { onHydrate as $onHydrate } from "saus/client"`,
    ...serializeImports(client.imports),
  ]

  // The container for top-level statements
  const topLevel = new MagicString(imports.join('\n') + '\n')
  script.addSource(topLevel)

  // The $onHydrate callback
  const onHydrate = new MagicString('')
  script.addSource(onHydrate)

  const importedModules = new Set<string>()
  const insertFunction = (fn: ClientFunction, name: string) => {
    for (const stmt of fn.referenced) {
      if (importedModules.has(stmt)) continue
      importedModules.add(stmt)
      topLevel.append(stmt + '\n')
    }
    topLevel.append(`const ${name} = ${fn.function}`)
    onHydrate.append(
      name == `$render`
        ? `const content = await $render(routeModule, request)\n`
        : `${name}(request)\n`
    )
  }

  beforeRenderFns?.forEach((fn, i) => {
    insertFunction(fn, `$beforeRender${i + 1}`)
  })
  insertFunction(renderFn, `$render`)
  onHydrate.append(client.onHydrate)
  if (renderFn.didRender) {
    insertFunction(renderFn.didRender, `$didRender`)
  }

  // Indent the function body, then wrap with $onHydrate call.
  onHydrate
    .indent('  ')
    .prepend(`$onHydrate(async (routeModule, request) => {\n`)
    .append(`\n})`)

  return {
    code: script.toString(),
    map: script.generateMap(),
  }
}
