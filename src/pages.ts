import {
  Client,
  ClientState,
  getClient,
  Renderer,
  Route,
  RouteParams,
  SausContext,
  matchRoute,
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

export function createPageFactory(context: SausContext) {
  const routes = [...context.routes].reverse()
  const renderers = [...context.renderers].reverse()

  async function renderPage(
    path: string,
    params: RouteParams,
    route: Route,
    renderer: Renderer,
    initialState?: Record<string, any>
  ): Promise<RenderedPage | null> {
    const routeModule = await route.load()
    const state = {
      ...initialState,
      routePath: route.path,
      routeParams: params,
    } as ClientState

    const html = await renderer.render(
      routeModule,
      { path, params, state },
      renderer
    )

    if (html == null) {
      return null
    }

    const filename = getPageFilename(path)
    const client =
      context.pages[filename]?.client || (await getClient(context, renderer))

    return (context.pages[filename] = {
      path,
      html,
      state,
      client,
      routeModuleId: route.moduleId,
    })
  }

  async function renderDefaultPage(
    path: string,
    params: RouteParams,
    route?: Route,
    initialState?: Record<string, any>
  ) {
    if (!route) {
      return null
    }
    return renderPage(
      path,
      params,
      route,
      context.defaultRenderer!,
      initialState
    )
  }

  async function renderUnknownPath(
    path: string,
    initialState?: Record<string, any>
  ) {
    return renderDefaultPage(path, {}, context.defaultRoute, initialState)
  }

  async function renderMatchedPath(
    path: string,
    params: RouteParams,
    route: Route,
    initialState?: Record<string, any>
  ) {
    if (route.state) {
      const state = await route.state(...Object.values(params))
      initialState = { ...initialState, ...state }
    }
    for (const renderer of renderers) {
      if (renderer.test(path)) {
        const page = await renderPage(
          path,
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
    return renderDefaultPage(path, params, route, initialState)
  }

  async function renderPath(
    path: string,
    next: (
      error?: Error | null,
      result?: RenderedPage | null
    ) => Promise<void> | void
  ) {
    let error: any

    for (const route of routes) {
      const params = matchRoute(path, route)
      if (!params) {
        continue
      }
      try {
        const page = await renderMatchedPath(path, params, route)
        return next(null, page)
      } catch (e: any) {
        error = e
      }
      break
    }

    // Skip requests with file extension, unless explicitly
    // handled by a non-default renderer.
    if (!error && /\.[^/]+$/.test(path)) {
      return next()
    }

    // Render the fallback page.
    if (context.defaultRenderer && context.defaultRoute) {
      try {
        const page = await renderUnknownPath(path, { error })
        return next(null, page)
      } catch (e: any) {
        error = e
      }
    }

    return next(error)
  }

  return {
    renderPath,
    renderUnknownPath,
    renderMatchedPath,
  }
}
