import type { PageBundle, PageBundleOptions } from '../bundle/types'
import type { Buffer } from '../client'
import type {
  AnyClientProps,
  BeforeRenderHook,
  Client,
  MergedHtmlProcessor,
  Renderer,
  RenderModule,
  Route,
  RoutesModule,
  RuntimeConfig,
  SausContext,
  WrappedNode,
} from '../core'
import type { Endpoint } from '../core/endpoint'
import type { ModuleRenderer } from '../core/getModuleRenderer'
import type { ParsedHead } from '../utils/parseHead'
import type { Falsy } from '../utils/types'
import type { ParsedUrl } from '../utils/url'

export interface App extends ModuleRenderer {
  config: RuntimeConfig
  resolveRoute: RouteResolver
  getEndpoints: Endpoint.Generator | null
  callEndpoints(
    url: Endpoint.RequestUrl,
    endpoints?: readonly Endpoint.Function[]
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
  preProcessHtml?: MergedHtmlProcessor
  postProcessHtml?: (page: RenderedPage, timeout?: number) => Promise<string>
}

export namespace App {
  export type Plugin = (app: App) => Partial<App>
}

export interface AppContext extends RoutesModule, RenderModule {
  config: RuntimeConfig
  helpersId: string
  functions: ClientFunctions
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
  routeModuleId: string
  stateModules: string[]
  client?: Client
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

// Each page has its own render module in SSR mode.
export interface PageContext extends RenderModule {}

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
  setup?: (context: PageContext, route: Route, url: ParsedUrl) => any
}

type BundledFunction = {
  function: string
  referenced: string[]
  transformResult?: undefined
}

type DevFunction = {
  referenced: WrappedNode<any>[]
  transformResult?: BundledFunction
}

export type ClientFunction = (BundledFunction | DevFunction) & {
  start: number
  route?: string
  function: string
}

export type RenderFunction = ClientFunction & {
  didRender?: ClientFunction
}

/* Stub module replaced at build time */
export interface ClientFunctions {
  filename: string
  beforeRender: ClientFunction[]
  render: RenderFunction[]
}

export type ResolvedRoute =
  | [endpoints: readonly Endpoint[], route: Route]
  | [endpoints: readonly Endpoint[], route?: undefined]

export type RouteResolver = (url: Endpoint.RequestUrl) => ResolvedRoute

export type ClientResolver = (
  renderer: Renderer,
  beforeHooks: BeforeRenderHook[]
) => Promise<Client | undefined>

export type ClientPropsLoader = (
  url: ParsedUrl,
  route: Route
) => Promise<AnyClientProps>
