import type { PageBundle, PageBundleOptions } from '../../bundle/types'
import type { Buffer } from '../client/buffer'
import type {
  AnyClientProps,
  CommonClientProps,
  MergedHtmlProcessor,
  Route,
  RoutesModule,
  RuntimeConfig,
  SausContext,
} from '../core'
import type { Endpoint } from '../endpoint'
import type { ParsedUrl } from '../node/url'
import { CacheEntry } from '../runtime/withCache'
import type { ParsedHead } from '../utils/parseHead'
import type { Falsy } from '../utils/types'

export interface App {
  config: RuntimeConfig
  catchRoute: Route | undefined
  defaultRoute: Route | undefined
  resolveRoute: RouteResolver
  getEndpoints: Endpoint.Generator | null
  callEndpoints(
    url: Endpoint.RequestUrl,
    resolved?: ResolvedRoute
  ): Promise<Partial<Endpoint.Response>>
  loadClientProps: ClientPropsLoader
  renderPage: RenderPageFn
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
  renderPageState(
    { path, props, stateModules, head }: RenderedPage,
    preloadUrls?: string[]
  ): string
  /**
   * Convert a "state module" (defined with a build-time `defineStateModule` call)
   * into an ES module that is ready for the browser. Once loaded, their state is
   * stored in the client's global cache, which allows for synchronous access via
   * the `StateModule#get` method.
   */
  renderStateModule(
    cacheKey: string,
    cachedState: CacheEntry<any>,
    inline?: boolean
  ): string
  preProcessHtml?: MergedHtmlProcessor
  postProcessHtml?: (page: RenderedPage, timeout?: number) => Promise<string>
}

export namespace App {
  export type Plugin = (app: App) => Partial<App> | void
}

export interface AppContext extends RoutesModule {
  config: RuntimeConfig
  getCachedPage: SausContext['getCachedPage']
  onError: (e: any) => void
  profile?: ProfiledEventHandler
}

export type BufferLike = string | Buffer | globalThis.Buffer

export type RenderedFile = {
  id: string
  data: BufferLike
  mime: string
}

export type RenderedPage = {
  path: string
  html: string
  head: ParsedHead
  files: RenderedFile[]
  props: AnyClientProps
  route: Route
  stateModules: string[]
  isDebug?: boolean
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
  props?: AnyClientProps
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

export type ResolvedRoute =
  | [endpoints: readonly Endpoint[], route: Route]
  | [endpoints: readonly Endpoint[], route?: undefined]

export type RouteResolver = (url: Endpoint.RequestUrl) => ResolvedRoute

export type ClientPropsLoader = (
  url: ParsedUrl,
  route: Route
) => Promise<AnyClientProps>

export interface CommonServerProps extends CommonClientProps {
  _client: CommonClientProps
  _ts?: number
}
