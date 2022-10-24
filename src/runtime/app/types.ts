import type { Buffer } from '@utils/buffer'
import type { ParsedHead } from '@utils/parseHead'
import type { Falsy } from '@utils/types'
import type { PageBundle, PageBundleOptions } from '../bundleTypes'
import type { Cache } from '../cache'
import type { CommonClientProps } from '../clientTypes'
import type { RuntimeConfig } from '../config'
import type { Endpoint } from '../endpoint'
import type { MergedHtmlProcessor } from '../html/process'
import type { Route, RoutesModule } from '../routeTypes'
import type { StateModule } from '../stateModules'
import type { ParsedUrl } from '../url'

export interface App {
  readonly config: RuntimeConfig
  readonly catchRoute: Route | undefined
  readonly defaultRoute: Route | undefined
  resolveRoute: RouteResolver
  getEndpoints: Endpoint.Generator | null
  callEndpoints(
    url: Endpoint.RequestUrl,
    resolved?: ResolvedRoute
  ): Promise<Partial<Endpoint.Response>>
  loadPageProps: PagePropsLoader
  renderPage: RenderPageFn
  /**
   * Available in SSR bundles only.
   *
   * Match a route to the given URL and render its page bundle.
   */
  resolvePageBundle: (
    url: string,
    options?: PageBundleOptions
  ) => Promise<PageBundle | null>
  /**
   * Available in SSR bundles only.
   *
   * Render a page and the modules it uses.
   */
  renderPageBundle: (
    url: ParsedUrl,
    route: Route,
    options?: PageBundleOptions
  ) => Promise<PageBundle | null>
  /**
   * The entry module of a specific page, which includes page-specific state,
   * possibly some `<head>` tags, and preloaded state modules.
   */
  renderPageState(page: RenderedPage, preloadUrls?: string[]): string
  /**
   * Convert a "state module" (defined with a build-time `defineStateModule` call)
   * into an ES module that is ready for the browser. Once loaded, their state is
   * stored in the client's global cache, which allows for synchronous access via
   * the `StateModule#get` method.
   */
  renderStateModule(name: string, entry: Cache.Entry, inline?: boolean): string
  preProcessHtml?: MergedHtmlProcessor
  postProcessHtml?: (page: RenderedPage, timeout?: number) => Promise<string>
}

export namespace App {
  export type Plugin = (app: App) => Partial<App> | void

  export interface Context extends RoutesModule {
    config: RuntimeConfig
    pageCache: Cache<RenderPageResult>
    onError: (e: any) => void
    profile?: ProfiledEventHandler
  }
}

export type BufferLike = string | Buffer | globalThis.Buffer

export type RenderedFile = {
  id: string
  data: BufferLike
  mime: string
  expiresAt?: number
}

export type RenderedPage = {
  path: string
  html: string
  head: ParsedHead
  files: RenderedFile[]
  props: AnyServerProps
  route: Route
  isDebug?: boolean
}

export type LoadedStateModule = Cache.Entry & {
  stateModule: StateModule
  /** When true, this module was already cached. */
  wasCached: boolean
  /** When true, this module was inlined with page-specific state. */
  inlined: boolean
}

export type ProfiledEvent = {
  url: string
  timestamp: number
  duration: number
}

export type ProfiledEventType =
  | 'load state'
  | 'render html'
  | 'process html'
  | 'render client'

type ProfiledEventHandlerArgs =
  | [type: ProfiledEventType, event: ProfiledEvent]
  | [type: 'error', error: any]

export interface ProfiledEventHandler {
  (...args: ProfiledEventHandlerArgs): void
}

export type RenderPageFn = (
  url: ParsedUrl,
  route: Route,
  options?: RenderPageOptions
) => Promise<RenderPageResult>

export type RenderPageResult = [page: RenderedPage | null, error?: any]

export type RenderPageOptions = {
  props?: AnyServerProps
  request?: Endpoint.Request
  resolved?: ResolvedRoute
  timeout?: number
  isDebug?: boolean
  defaultRoute?: Route | Falsy
  onError?: (error: Error & { url: string }) => void
  renderStart?: (url: ParsedUrl) => void
  renderFinish?: (
    url: ParsedUrl,
    error: Error | null,
    page?: RenderedPage | null
  ) => void
  /**
   * The setup hook can manipulate the render hooks,
   * allowing for rendered pages to be isolated from
   * each other if desired.
   */
  setup?: (route: Route, url: ParsedUrl) => any
}

export interface ResolvedRoute {
  /**
   * A route that matches the request path and also has
   * at least one function that's able to handle the request.
   *
   * If undefined, then no route was matched.
   */
  route?: Route
  /**
   * Functions related to the matched route which are able
   * to serve the current request.
   */
  functions: readonly Endpoint.Function[]
  /**
   * These routes haven't tried matching the request path yet,
   * so they might have viable functions.
   */
  remainingRoutes: readonly Route[]
}

export type RouteResolver = (
  url: Endpoint.RequestUrl,
  routes?: readonly Route[]
) => ResolvedRoute

export type PagePropsLoader = (
  url: ParsedUrl,
  route: Route
) => Promise<AnyServerProps>

export type AnyServerProps = CommonServerProps & Record<string, any>

export interface CommonServerProps extends CommonClientProps {
  _ts: number
  _maxAge: Cache.MaxAge
  _inlined: LoadedStateModule[]
  _included: LoadedStateModule[]
  _headProps: Record<string, any> | undefined
  _clientProps: CommonClientProps
}
