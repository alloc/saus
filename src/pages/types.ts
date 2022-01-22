import type { HeadDescription } from '../client'
import type {
  Client,
  ClientState,
  RenderModule,
  RoutesModule,
  SausContext,
  WrappedNode,
} from '../core'

export type RenderedPage = {
  path: string
  html: string
  head?: HeadDescription
  state: ClientState
  client?: Client
  stateModules: string[]
  routeModuleId: string
}

type SausContextKeys =
  | 'basePath'
  | 'defaultPath'
  | 'loadedStateCache'
  | 'loadingStateCache'
  | 'pages'

export interface PageFactoryContext
  extends Pick<SausContext, SausContextKeys>,
    RoutesModule,
    RenderModule {
  logger: { error(msg: string): void }
}

// Each page has its own render module in SSR mode.
export interface PageContext extends RenderModule {}

export type RenderPageOptions = {
  preferCache?: boolean
  renderStart?: (url: string) => void
  renderFinish?: (
    url: string,
    error: Error | null,
    page?: RenderedPage | null
  ) => void
  /**
   * The setup hook can manipulate the render hooks,
   * allowing for rendered pages to be isolated from
   * each other if desired.
   */
  setup?: (context: PageContext) => any
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
