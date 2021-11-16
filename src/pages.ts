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

export function getPageFilename(url: string) {
  return url == '/' ? 'index.html' : url.slice(1) + '.html'
}

export type PageFactory = ReturnType<typeof createPageFactory>

export type RenderedPage = {
  path: string
  html: string
  state: ClientState
  client?: Client
  routeModuleId: string
}

const urlPathRegex = /^(.+?)(?:#([^?]*))?(?:\?(.*))?$/

export function createPageFactory({
  renderPath: rendererPath,
  pages,
  routes,
  renderers,
  defaultRoute,
  defaultRenderer,
  beforeRenderHooks,
  logger,
}: SausContext) {
  routes = [...routes].reverse()
  renderers = [...renderers].reverse()

  const warnings = new Set<string>()
  const warn = (msg: string) => {
    if (!warnings.has(msg)) {
      warnings.add(msg)
      logger.warn(msg)
    }
  }

  // The main logic for rendering a page.
  async function renderPage(
    url: string,
    params: RouteParams,
    route: Route,
    renderer: Renderer,
    initialState?: Record<string, any>
  ): Promise<RenderedPage | null> {
    debug(`Loading route: "${route.moduleId}"`)
    const routeModule = await route.load()
    const state = {
      ...initialState,
      routePath: route.path,
      routeParams: params,
    } as ClientState

    const [, path, hash, query] = urlPathRegex.exec(url)!
    const request: RenderRequest = { path, hash, query, params, state }

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

    debug(`Rendering page: "${request.path}"`)
    const html = await renderer.render(routeModule, request, renderer)
    if (html == null) {
      debug(`Nothing was rendered. Trying next renderer.`)
      return null
    }

    const filename = getPageFilename(url)
    let client = pages[filename]?.client
    if (!client) {
      debug(`Generating client module`)
      client = await getClient(rendererPath, renderer, usedHooks)
    }

    // Currently, the page cache is only used by the saus:client plugin,
    // since the performance impact of rendering on every request isn't
    // bad enough to justify complicated cache invalidation.
    return (pages[filename] = {
      path: url,
      html,
      state,
      client,
      routeModuleId: route.moduleId,
    })
  }

  /**
   * Use the default renderer to render HTML for the given `url`.
   * If the given `route` is undefined, nothing is rendered.
   */
  async function renderDefaultPage(
    url: string,
    params: RouteParams,
    route?: Route,
    initialState?: Record<string, any>
  ) {
    if (!route) {
      return null
    }
    if (!defaultRenderer) {
      warn('Default renderer is not defined')
      return null
    }
    return renderPage(url, params, route, defaultRenderer, initialState)
  }

  /**
   * Use the default route to render HTML for the given `url`.
   */
  async function renderUnknownPage(
    url: string,
    initialState?: Record<string, any>
  ) {
    return renderDefaultPage(url, {}, defaultRoute, initialState)
  }

  /**
   * Skip route matching and render HTML for the given `url` using
   * the given route and params.
   */
  async function renderRoute(
    url: string,
    params: RouteParams,
    route: Route,
    initialState?: Record<string, any>
  ) {
    if (route.state) {
      const state = await route.state(...Object.values(params))
      initialState = { ...initialState, ...state }
    }
    const path = url.replace(/[?#].+$/, '')
    for (const renderer of renderers) {
      if (renderer.test(path)) {
        const page = await renderPage(
          url,
          params,
          route,
          renderer,
          initialState
        )
        if (page) {
          return page
        }
      }
    }
    return renderDefaultPage(url, params, route, initialState)
  }

  /**
   * Find a matching route to render HTML for the given `url`.
   */
  async function resolvePage(
    url: string,
    next: (
      error?: Error | null,
      result?: RenderedPage | null
    ) => Promise<void> | void
  ) {
    let error: any

    const path = url.replace(/[?#].+$/, '')
    for (const route of routes) {
      const params = matchRoute(path, route)
      if (!params) {
        continue
      }
      try {
        const page = await renderRoute(url, params, route)
        return next(null, page)
      } catch (e: any) {
        error = e
      }
      break
    }

    // Skip requests with file extension, unless explicitly
    // handled by a non-default renderer.
    if (!error && /\.[^/]+$/.test(url)) {
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
  }

  return {
    resolvePage,
    renderUnknownPage,
    renderRoute,
  }
}
