import createDebug from 'debug'
import MagicString, { Bundle as MagicBundle } from 'magic-string'
import md5Hex from 'md5-hex'
import os from 'os'
import path from 'path'
import { withCache } from './client/withCache'
import type {
  BeforeRenderHook,
  Client,
  ClientDescription,
  ClientState,
  Renderer,
  RenderRequest,
  Route,
  RouteInclude,
  RouteModule,
  RouteParams,
  RuntimeConfig,
  StateModule,
} from './core'
import { setRoutesModule } from './core/global'
import { mergeHtmlProcessors } from './core/html'
import { matchRoute } from './core/routes'
import { isStateModule, stateModulesMap } from './core/stateModules'
import {
  ClientFunction,
  ClientFunctions,
  PageContext,
  PageFactoryContext,
  RenderedPage,
  RenderFunction,
  RenderPageOptions,
} from './pages/types'
import { getPageFilename } from './utils/getPageFilename'
import { serializeImports } from './utils/imports'
import { limitConcurrency } from './utils/limitConcurrency'
import { noop } from './utils/noop'
import { ParsedUrl, parseUrl } from './utils/url'

const debug = createDebug('saus:pages')

export type PageFactory = ReturnType<typeof createPageFactory>

export function createPageFactory(
  context: PageFactoryContext,
  functions: ClientFunctions,
  config: RuntimeConfig,
  setup?: () => Promise<any>
) {
  let {
    basePath,
    beforeRenderHooks,
    defaultRoute,
    defaultState,
    logger,
    pages,
    processHtml,
    renderers,
    routes,
  } = context

  // Pages cannot be rendered in parallel, or else we risk inconsistencies
  // caused by global state mutation. This will be fixed in the future with
  // isolated module instances.
  const setupPromise = (async () => {
    if (setup) {
      await setup()
    }
    setRoutesModule(context)
    context.runtimeHooks.forEach(onSetup => {
      try {
        onSetup(config)
      } catch (error: any) {
        logger.error(error.stack)
      }
    })
    setRoutesModule(null)
    if (context.htmlProcessors) {
      processHtml = mergeHtmlProcessors(
        context.htmlProcessors,
        page => ({ page, config }),
        ['pre', 'default']
      )
    }

    defaultRoute = context.defaultRoute
    defaultState = context.defaultState

    // Routes and renderers are matched in reverse order.
    routes = [...context.routes].reverse()
    renderers.reverse()
  })()

  // The main logic for rendering a page.
  async function renderPage(
    url: ParsedUrl,
    state: ClientState,
    route: Route,
    routeModule: RouteModule,
    renderer: Renderer,
    beforeRenderHooks: BeforeRenderHook[]
  ): Promise<RenderedPage | null> {
    const { path } = url
    const request: RenderRequest = {
      path,
      query: url.search,
      params: state.routeParams,
      state,
    }

    if (beforeRenderHooks.length) {
      debug(`Running beforeRender hooks`)
    }

    const usedHooks: BeforeRenderHook[] = []
    for (const hook of beforeRenderHooks) {
      const params = hook.match ? hook.match(path) : {}
      if (params) {
        usedHooks.push(hook)
        await hook({ ...request, params })
      }
    }

    debug(`Rendering page: %s`, path)
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
      stateModules: stateModulesMap.get(state)!,
      routeModuleId: route.moduleId,
    }

    if (processHtml) {
      page.html = await processHtml(page.html, page)
    }

    debug(`Page ready: %s`, path)

    // Currently, the page cache is only used by the saus:client plugin,
    // since the performance impact of rendering on every request isn't
    // bad enough to justify complicated cache invalidation.
    return (pages[filename] = page)
  }

  type RenderPageFn = (url: ParsedUrl) => Promise<RenderedPage | null>

  const queuePage = limitConcurrency(
    // TODO: allow parallel rendering in dev mode?
    config.command !== 'dev'
      ? Math.max(1, config.renderConcurrency ?? os.cpus().length)
      : 1,
    (url: ParsedUrl, renderPage: RenderPageFn, options: RenderPageOptions) =>
      setupPromise.then(() => {
        debug(`Page in progress: %s`, url)
        options.renderStart?.(url.path)
        const rendering = renderPage(url)
        if (options.renderFinish)
          rendering.then(
            options.renderFinish.bind(null, url.path, null),
            options.renderFinish.bind(null, url.path)
          )
        return rendering
      })
  )

  // Concurrent requests to the same page will use the same promise.
  const loadingPages = new Map<string, Promise<RenderedPage | null>>()

  function loadPage(
    url: string | ParsedUrl,
    options: RenderPageOptions,
    renderPage: RenderPageFn
  ) {
    if (typeof url == 'string') {
      url = parseUrl(url)
    }
    let pagePath = url.path
    let loadingPage = loadingPages.get(pagePath)
    if (!loadingPage) {
      debug(`Page queued: %s`, url)
      loadingPages.set(
        pagePath,
        (loadingPage = queuePage(url, renderPage, options).finally(() => {
          loadingPages.delete(pagePath)
        }))
      )
    }
    return loadingPage
  }

  const resolveState = withCache<ClientState>(
    context.loadingStateCache,
    context.loadedStateCache
  )

  function loadStateModule(
    loaded: Map<string, Promise<any>>,
    state: StateModule
  ) {
    let loading = loaded.get(state.id)
    if (!loading) {
      loading = resolveState(state.id, state.load).catch(error => {
        logger.error(error.stack)
        return null
      })
      loaded.set(state.id, loading)
    }
    return loading
  }

  function loadStateModules(
    loaded: Map<string, Promise<any>>,
    include: RouteInclude,
    url: ParsedUrl,
    params: RouteParams
  ) {
    const included =
      typeof include == 'function' ? include(url, params) : include

    return included.map(loadStateModule.bind(null, loaded))
  }

  const loadPageState = (url: ParsedUrl, params: RouteParams, route: Route) =>
    resolveState(url.path, async () => {
      const pageState = await loadClientState(url, params, route)
      pageState.routePath = route.path
      pageState.routeParams = params
      return pageState
    })

  async function loadClientState(
    url: ParsedUrl,
    params: RouteParams,
    route: Route
  ) {
    let result: ClientState

    // Start loading state modules before the route state is awaited.
    const pendingStateModules = new Map<string, Promise<any>>()
    for (const include of defaultState.concat([route.include || []])) {
      loadStateModules(pendingStateModules, include, url, params)
    }

    if (route.state) {
      result = (await route.state(
        Object.values(params),
        url.searchParams
      )) as any

      // Load any embedded state modules.
      JSON.stringify(result, (key, state) => {
        if (!isStateModule(state)) {
          return state
        }
        loadStateModule(pendingStateModules, state)
        result[key] = { '@import': state.id }
      })
    } else {
      result = {} as any
    }

    await Promise.all(pendingStateModules.values())
    stateModulesMap.set(result, Array.from(pendingStateModules.keys()))

    return result
  }

  let pageContextQueue = Promise.resolve()

  async function getPageContext(
    url: ParsedUrl,
    options: RenderPageOptions
  ): Promise<PageContext> {
    if (!options.setup) {
      return { renderers, beforeRenderHooks }
    }
    const pageContext: PageContext = {
      renderers: [],
      beforeRenderHooks: [],
    }
    await options.setup(pageContext)
    return pageContext
  }

  async function loadPageContext(url: ParsedUrl, options: RenderPageOptions) {
    // In SSR mode, multiple pages must not load their modules at the
    // same time, or else they won't be isolated from each other.
    const loading = pageContextQueue.then(async () => {
      const [route, params] = resolveRoute(url)
      if (!route) {
        return [] as const
      }

      const pageContext = await getPageContext(url, options)

      let routeModule: RouteModule
      let state: ClientState
      let error: any

      try {
        ;[routeModule, state] = await Promise.all([
          route.load(),
          loadPageState(url, params || {}, route),
        ] as const)
      } catch (e) {
        error = e
      }

      const { beforeRenderHooks } = pageContext
      return [
        pageContext,
        error,
        (renderer: Renderer) =>
          renderPage(
            url,
            state,
            route,
            routeModule,
            renderer,
            beforeRenderHooks
          ),
      ] as const
    })

    pageContextQueue = loading.then(noop, noop)
    return loading
  }

  async function loadDefaultRoute(
    url: ParsedUrl,
    params: RouteParams,
    options: RenderPageOptions
  ) {
    const loading = pageContextQueue.then(async () => {
      if (!defaultRoute) {
        return [null] as const
      }
      await getPageContext(url, options)
      return Promise.all([
        defaultRoute,
        defaultRoute.load(),
        loadClientState(url, params, defaultRoute),
      ] as const)
    })

    pageContextQueue = loading.then(noop, noop)
    return loading
  }

  function resolveRoute(url: ParsedUrl): [Route?, RouteParams?] {
    let route: Route | undefined
    for (route of routes) {
      const params = matchRoute(url.path, route)
      if (params) {
        return [route, params]
      }
    }
    if ((route = defaultRoute)) {
      return [route]
    }
    return []
  }

  return {
    /**
     * Get or load state from the cache.
     */
    resolveState,
    /**
     * Get the hydration state of the given URL.
     */
    async getPageState(filename: string) {
      await setupPromise
      const url = parseUrl(filename.replace(/(\/index)?\.html$/, '') || '/')
      const [route, params] = resolveRoute(url)
      if (route) {
        return loadPageState(url, params || {}, route)
      }
    },
    /**
     * Find a matching route to render HTML for the given `url`.
     */
    render: (url: string | ParsedUrl, options: RenderPageOptions = {}) =>
      loadPage(url, options, async url => {
        let [context, error, render] = await loadPageContext(url, options)
        if (!context || !render) {
          return null
        }

        let page: RenderedPage | null
        let renderer: Renderer | undefined

        if (!error)
          for (renderer of context.renderers) {
            if (!renderer.test(url.path)) {
              continue
            }
            try {
              if ((page = await render(renderer))) {
                return page
              }
            } catch (e) {
              error = e
              break
            }
          }

        // Skip requests with file extension, unless explicitly
        // handled by a non-default renderer.
        if (!error && /\.[^/]+$/.test(url.path)) {
          return null
        }

        renderer = context.defaultRenderer
        if (!error) {
          if (!renderer) {
            return null
          }
          try {
            if ((page = await render(renderer))) {
              return page
            }
            return null
          } catch (e) {
            error = e
          }
        }

        if (!renderer) {
          throw error
        }

        // Use the default route to render an error page.
        const [route, routeModule, state] = await loadDefaultRoute(
          url,
          { error },
          options
        )

        if (!route) {
          throw error
        }

        return renderPage(
          url,
          state,
          route,
          routeModule,
          renderer,
          context.beforeRenderHooks
        )
      }),
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
    const { function: rawFn, referenced } = fn.transformResult || fn

    for (let stmt of referenced) {
      stmt = stmt.toString()
      if (!importedModules.has(stmt)) {
        importedModules.add(stmt)
        topLevel.append(stmt + '\n')
      }
    }

    topLevel.append(`const ${name} = ${rawFn}`)
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
