import * as RegexParam from 'regexparam'
import type {
  Client,
  ClientState,
  ClientProvider,
  SausContext,
} from './context'
import { getPageFilename, matchRoute, Route, RouteParams } from './routes'

export type PageFactory = ReturnType<typeof createPageFactory>

const noop = () => {}

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

    const request: PageRequest = { path, params, state }
    const html = await renderer.render(routeModule, request, {
      didRender: renderer.didRender || noop,
    })

    if (html == null) {
      return null
    }

    const filename = getPageFilename(path)

    let client = context.pages[filename]?.client
    if (!client) {
      const { getClient } = renderer
      if (getClient) {
        client = (await getClient(context, renderer)) || undefined
      }
    }

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

export class Renderer<T = any> {
  test: (path: string) => boolean
  didRender?: () => void
  getClient?: ClientProvider

  constructor(
    route: string,
    readonly render: (
      module: object,
      request: PageRequest,
      context: RenderContext
    ) => T | Promise<T>,
    readonly hash?: string,
    readonly start?: number
  ) {
    if (route) {
      const regex = RegexParam.parse(route).pattern
      this.test = regex.test.bind(regex)
    } else {
      this.test = () => true
    }
  }
}

/**
 * This context never exists on the client, so it should only be
 * accessed by renderer packages.
 */
export type RenderContext = {
  /**
   * Trigger the post-render effect (if one exists). This should be
   * called *immediately* after the HTML string is returned. We
   * recommend using a try-finally block.
   */
  readonly didRender: () => void
}

export type PageRequest<
  State extends object = ClientState,
  Params extends RouteParams = RouteParams
> = {
  path: string
  state: State
  params: Params
}

export class RenderCall {
  constructor(protected _renderer: Renderer<string>) {}

  /**
   * Set the function that generates the client module, which is responsible
   * for hydrating the page. If you're using a framework package like
   * `@saus/react`, you won't need to call this.
   */
  withClient(provider: ClientProvider) {
    this._renderer.getClient = provider
    return this
  }

  /**
   * Run an isomorphic function after render. In SSR, it runs after the
   * HTML string is rendered. On the client, it runs post-hydration.
   */
  then(didRender: () => void) {
    this._renderer.didRender = didRender
  }
}
