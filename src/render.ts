import * as RegexParam from 'regexparam'
import type {
  Client,
  ClientState,
  ClientProvider,
  SausContext,
} from './context'
import {
  getPageFilename,
  matchRoute,
  Route,
  RouteLoader,
  RouteModule,
  RouteParams,
} from './routes'

export type PageFactory = ReturnType<typeof createPageFactory>

const noop = () => {}
const neverTrue = () => false

const importRE = /\b__vite_ssr_dynamic_import__\(["']([^"']+)["']\)/
const parseDynamicImport = (fn: Function) => importRE.exec(fn.toString())![1]

export type RenderedPage = {
  path: string
  html: string
  state: ClientState
  client?: Client
  renderer: Renderer<string>
}

export function createPageFactory(context: SausContext) {
  const routes = [...context.routes].reverse()
  const renderers = [...context.renderers].reverse()

  async function renderPage(
    path: string,
    params: RouteParams,
    loadRoute: RouteLoader,
    renderer: Renderer
  ): Promise<RenderedPage | null> {
    const routeModule = await loadRoute()
    const state: ClientState = {}
    const html = await renderer.render(routeModule, params, {
      didRender: renderer.didRender || noop,
      state,
    })
    if (html == null) {
      return null
    }
    const client = await renderClient(path, renderer)
    state.routeModuleId = parseDynamicImport(loadRoute)
    state.routeParams = params
    const filename = getPageFilename(path)
    return (context.pages[filename] = {
      path,
      html,
      state,
      client,
      renderer,
    })
  }

  async function renderClient(path: string, renderer: Renderer) {
    let client = context.pages[path]?.client
    if (!client) {
      const { getClient } = renderer
      if (getClient) {
        client = (await getClient(context, renderer)) || undefined
      }
    }
    return client
  }

  async function renderUnknownPath(
    path: string,
    params: RouteParams = {},
    loadRoute: RouteLoader = context.defaultRoute!
  ) {
    return renderPage(
      path,
      params,
      loadRoute,
      context.defaultRenderer!
    ) as Promise<RenderedPage>
  }

  async function renderMatchedPath(
    path: string,
    params: RouteParams,
    route: Route
  ) {
    for (const renderer of renderers) {
      if (renderer.test(path)) {
        const page = await renderPage(path, params, route.load, renderer)
        if (page) {
          return page
        }
      }
    }
    return renderUnknownPath(path, params, route.load)
  }

  async function renderPath(
    path: string,
    next: (error?: Error | null, result?: RenderedPage) => Promise<void> | void
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
  test: (path: string) => boolean = neverTrue
  didRender?: () => void
  getClient?: ClientProvider

  constructor(
    route: string,
    readonly render: RenderHook<T>,
    readonly hash?: string,
    readonly start?: number
  ) {
    if (route) {
      const regex = RegexParam.parse(route).pattern
      this.test = regex.test.bind(regex)
    }
  }
}

export type RenderResult<T> =
  | [Exclude<T, null | void>, ClientState, Renderer]
  | (T extends null | void ? null : never)

export type RenderHook<T, Params = RouteParams> = (
  module: RouteModule,
  params: Params,
  context: RenderContext
) => T | Promise<T>

export type RenderContext = {
  /** JSON state used by the client */
  readonly state: Record<string, any>
  /** Call this to reset global UI state */
  readonly didRender: () => void
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
