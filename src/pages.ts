import MagicString, { Bundle as MagicBundle } from 'magic-string'
import md5Hex from 'md5-hex'
import path from 'path'
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
  RouteParams,
  RoutesModule,
  RuntimeConfig,
  SausContext,
} from './core'
import { debug } from './core/debug'
import { mergeHtmlProcessors } from './core/html'
import { matchRoute } from './core/routes'
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
  routeModuleId: string
}

export interface PageFactoryContext
  extends Pick<SausContext, 'basePath' | 'pages' | 'states'>,
    RoutesModule,
    RenderModule {
  logger: { warn(msg: string): void }
}

export function createPageFactory(
  context: PageFactoryContext,
  functions: ClientFunctions,
  config?: RuntimeConfig
) {
  let {
    pages,
    states,
    routes,
    renderers,
    defaultRoute,
    defaultRenderer,
    beforeRenderHooks,
    processHtml,
    basePath,
    logger,
  } = context

  routes = [...routes].reverse()
  renderers = [...renderers].reverse()

  // Pages cannot be rendered in parallel, or else we risk inconsistencies
  // caused by global state mutation.
  let renderQueue = Promise.resolve()

  if (config) {
    const setup = () => {
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
    }

    // For SSR script bundles, setImmediate is used to allow for runtime hooks
    // to be initiated before the page factory is accessible. Therefore, we need
    // to wait for those runtime hooks here.
    if (config?.bundleType === 'script') {
      const { promise, resolve } = defer<void>()
      renderQueue = promise
      setImmediate(() => {
        setup()
        resolve()
      })
    } else {
      setup()
    }
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
  function renderPage(
    url: ParsedUrl,
    state: ClientState,
    route: Route,
    renderer: Renderer
  ): Promise<RenderedPage | null> {
    debug(`Page queued: ${url}`)
    const pagePromise = renderQueue.then(async () => {
      debug(`Page next up: ${url}`)

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
    })

    renderQueue = pagePromise.then(noop, noop)
    return pagePromise
  }

  function resolveState(url: ParsedUrl, params: RouteParams, route: Route) {
    let state = states[url.path]
    if (!state) {
      state = states[url.path] = defer()
      loadState(route, url, params).then(state.resolve, error => {
        delete states[url.path]
        state.reject(error)
      })
      if (route.include) {
        state.then(() =>
          Promise.all(
            (typeof route.include == 'function'
              ? route.include(url)
              : route.include!
            ).map(fragment => fragment.load())
          )
        )
      }
    }
    return state.promise
  }

  /**
   * Use the default renderer to render HTML for the given `url`.
   * If the given `route` is undefined, nothing is rendered.
   */
  async function renderDefaultPage(
    url: ParsedUrl,
    state: ClientState,
    route: Route
  ) {
    if (defaultRenderer) {
      return renderPage(url, state, route, defaultRenderer)
    }
    warn('Default renderer is not defined')
    return null
  }

  async function renderUnknownPage(
    url: string | ParsedUrl,
    params: RouteParams = {}
  ) {
    if (!defaultRoute) {
      return null
    }
    if (typeof url == 'string') {
      url = parseUrl(url)
    }
    const state = await resolveState(url, params, defaultRoute)
    return renderDefaultPage(url, state, defaultRoute)
  }

  async function renderRoute(
    url: string | ParsedUrl,
    params: RouteParams,
    route: Route
  ) {
    if (typeof url == 'string') {
      url = parseUrl(url)
    }
    const state = await resolveState(url, params, route)
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

  return {
    /**
     * Skip route matching and render HTML for the given `url` using
     * the given route and params.
     */
    renderRoute,
    /**
     * Use the default route to render HTML for the given `url`.
     */
    renderUnknownPage,
    /**
     * Find a matching route to render HTML for the given `url`.
     */
    async resolvePage(
      url: string | ParsedUrl,
      next: (
        error?: Error | null,
        result?: RenderedPage | null
      ) => Promise<void> | void
    ) {
      if (typeof url == 'string') {
        url = parseUrl(url)
      }

      let route: Route | undefined
      let error: any

      try {
        route = routeMap[url.path]
        if (route) {
          const params = matchRoute(url.path, route)!
          const page = await renderRoute(url, params, route)
          return next(null, page)
        }
        for (route of routes) {
          const params = matchRoute(url.path, route)
          if (params) {
            routeMap[url.path] = route

            const page = await renderRoute(url, params, route)
            return next(null, page)
          }
        }
      } catch (e: any) {
        error = e
      }

      // Skip requests with file extension, unless explicitly
      // handled by a non-default renderer.
      if (!error && /\.[^/]+$/.test(url.path)) {
        return next()
      }

      // Render the fallback page.
      if (defaultRenderer && defaultRoute) {
        try {
          const page = await renderUnknownPage(url, { error })
          return next(null, page)
        } catch (e: any) {
          error = e
        }
      }

      return next(error)
    },
    /**
     * Get the client state for the given URL.
     */
    async getState(url: string | ParsedUrl): Promise<ClientState | undefined> {
      if (typeof url == 'string') {
        url = parseUrl(url)
      }

      let params: RouteParams | undefined

      const route =
        (routeMap[url.path] ||= routes.find(
          route => (params = matchRoute((url as ParsedUrl).path, route))
        )) || defaultRoute

      if (route) {
        if (!states[url.path]) {
          params ??= matchRoute(url.path, route)!
          await renderRoute(url, params, route)
        }
        return states[url.path]?.promise
      }
    },
  }
}

async function loadState(
  route: Route,
  url: ParsedUrl,
  params: RouteParams
): Promise<ClientState> {
  const state =
    route.state && (await route.state(Object.values(params), url.searchParams))

  return {
    ...state,
    routePath: route.path,
    routeParams: params,
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
