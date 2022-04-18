import type { Buffer } from '../client'
import type {
  BeforeRenderHook,
  Client,
  ClientState,
  Renderer,
  RenderModule,
  Route,
  RouteParams,
  RoutesModule,
  RuntimeConfig,
  SausContext,
  WrappedNode,
} from '../core'
import type { Endpoint } from '../core/endpoint'
import type { ParsedHead } from '../utils/parseHead'
import type { ParsedUrl } from '../utils/url'

export interface AppContext extends RoutesModule, RenderModule {
  config: RuntimeConfig
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
  stateModules: string[]
  routeModuleId: string
  state?: ClientState
  client?: Client
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
  state?: ClientState
  request?: Endpoint.StaticRequest
  resolved?: ResolvedRoute
  timeout?: number
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
  | [endpoints: readonly Endpoint[], route: Route, params: RouteParams]
  | [endpoints: readonly Endpoint[], route?: undefined, params?: undefined]

export type RouteResolver = (url: Endpoint.RequestUrl) => ResolvedRoute

export type ClientResolver = (
  renderer: Renderer,
  beforeHooks: BeforeRenderHook[]
) => Promise<Client | undefined>

export type ClientStateLoader = (
  url: ParsedUrl,
  route: Route
) => Promise<ClientState>
