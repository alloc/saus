import { debug } from './core/debug'
import {
  Client,
  ClientState,
  getClient,
  Renderer,
  Route,
  RouteParams,
  SausContext,
  matchRoute,
  RenderRequest,
  BeforeRenderHook,
} from './core'
import { defer } from './utils/defer'
import { noop } from './utils/noop'
import { ParsedUrl, parseUrl } from './utils/url'

export function getPageFilename(path: string) {
  return path == '/' ? 'index.html' : path.slice(1) + '.html'
}

export type PageFactory = ReturnType<typeof createPageFactory>

export type RenderedPage = {
  path: string
  html: string
  client?: Client
  routeModuleId: string
}

export function createPageFactory({
  renderPath: rendererPath,
  pages,
  states,
  routes,
  renderers,
  defaultRoute,
  defaultRenderer,
  beforeRenderHooks,
  logger,
}: SausContext) {
  routes = [...routes].reverse()
  renderers = [...renderers].reverse()

  // Pages cannot be rendered in parallel, or else we risk inconsistencies
  // caused by global state mutation.
  let renderQueue = Promise.resolve()

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

      debug(`Rendering page: ${url}`)
      const html = await renderer.render(routeModule, request, renderer)
      if (html == null) {
        debug(`Nothing was rendered. Trying next renderer.`)
        return null
      }

      const filename = getPageFilename(path)
      let client = pages[filename]?.client
      if (!client) {
        debug(`Generating client module`)
        client = await getClient(rendererPath, renderer, usedHooks)
      }

      debug(`Page ready: ${url}`)

      // Currently, the page cache is only used by the saus:client plugin,
      // since the performance impact of rendering on every request isn't
      // bad enough to justify complicated cache invalidation.
      return (pages[filename] = {
        path,
        html,
        client,
        routeModuleId: route.moduleId,
      })
    })

    renderQueue = pagePromise.then(noop, noop)
    return pagePromise
  }

  function resolveState(
    url: ParsedUrl,
    params: RouteParams,
    route: Route,
    cacheKey = getCacheKey(route, url)
  ) {
    let state = states[cacheKey]
    if (!state) {
      state = states[cacheKey] = defer()
      loadState(route, url, params).then(state.resolve, error => {
        delete states[cacheKey]
        state.reject(error)
      })
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
    route: Route,
    cacheKey?: string
  ) {
    if (typeof url == 'string') {
      url = parseUrl(url)
    }
    const state = await resolveState(url, params, route, cacheKey)
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
        const cacheKey = getCacheKey(route, url)
        if (!states[cacheKey]) {
          params ??= matchRoute(url.path, route)!
          await renderRoute(url, params, route, cacheKey)
        }
        return states[cacheKey]?.promise
      }
    },
  }
}

function getCacheKey(route: Route, url: ParsedUrl) {
  return route.cacheKey ? route.cacheKey(url) : url.toString()
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
