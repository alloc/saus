import path from 'path'
import regexParam from 'regexparam'
import * as vite from 'vite'
import { readStiteYaml } from './config'
import { UserConfig, SourceDescription } from './vite'

let context!: Context

export const logger = new Proxy({} as vite.Logger, {
  get(_, key: keyof vite.Logger) {
    return context.logger[key]
  },
})

export interface Context {
  root: string
  logger: vite.Logger
  config: vite.UserConfig
  configEnv: vite.ConfigEnv
  configPath: string | null
  /** Functions that modify the Vite config */
  configHooks: ConfigHook[]
  /** Path to the routes module */
  routesPath: string
  /** Routes added with `defineRoutes` */
  routes: RouteConfig[]
  /** Generated clients by route */
  clients: Record<string, Client>
  /** The route used when no route is matched */
  defaultRoute?: () => Promise<RouteModule>
  /** Path to the render module */
  renderPath: string
  /** The renderers for specific routes */
  renderers: Renderer<string>[]
  /** The renderer used when no route is matched */
  defaultRenderer?: Renderer<string>
}

export interface RouteModule extends Record<string, any> {}

export type RouteParams = Record<string, string> & { error?: any }

export type RouteConfig = {
  route: string
  keys: string[]
  pattern: RegExp
  import: () => Promise<RouteModule>
  query?: () => string[] | Promise<string[]>
}

export type ClientState = Record<string, any> & {
  routeModuleId: string
  routeParams: Record<string, string>
}

/** A generated client module */
export type Client = SourceDescription & {
  id: string
  state: ClientState
}

/** Function that generates a client module */
export type ClientProvider = (
  state: ClientState,
  renderer: Renderer<string>,
  context: Context
) => Client | Promise<Client>

export type RenderResult<T> = Promise<T> | T
export type RenderHook<T> = (
  module: Record<string, any>,
  params: Record<string, string>,
  context: RenderContext
) => RenderResult<T>

const noop = () => {}

export class Renderer<T> {
  getClient?: ClientProvider
  didRender = noop
  test: (path: string) => boolean
  constructor(
    readonly render: RenderHook<T>,
    readonly route: string,
    readonly start?: number
  ) {
    const regex = regexParam(route).pattern
    this.test = regex.test.bind(regex)
  }
}

export type RenderContext = {
  /** JSON state used by the client */
  readonly state: ClientState
  /** Call this to reset global UI state */
  readonly didRender: () => void
}

export type RenderPromise = {
  /**
   * Run an isomorphic function after render. In SSR, it runs after the
   * HTML string is rendered. On the client, it runs post-hydration.
   */
  then(didRender: () => void): void
  /**
   * Set the function that generates the client module, which is responsible
   * for hydrating the page. If you're using a framework package like
   * `@stite/react`, you won't need to call this.
   */
  withClient(provider: ClientProvider): RenderPromise
}

export type ConfigHook = (
  config: UserConfig,
  context: Context
) => void | Promise<void>

/**
 * Hook into the rendering process that generates HTML for a page.
 *
 * Return nothing to defer to the next renderer.
 */
export function render(
  route: string,
  hook: RenderHook<string | null | void>,
  start?: number
): RenderPromise

/** Set the fallback renderer. */
export function render(hook: RenderHook<string>, start?: number): RenderPromise

export function render(arg1: any, arg2?: any, arg3?: any): RenderPromise {
  let renderer: Renderer<any>
  if (typeof arg1 === 'string') {
    renderer = new Renderer(arg2, arg1, arg3)
    context.renderers.push(renderer)
  } else {
    renderer = new Renderer(arg1, '/*', arg2)
    context.defaultRenderer = renderer
  }
  return {
    then(didRender) {
      renderer.didRender = didRender
    },
    withClient(provider) {
      renderer.getClient = provider
      return this
    },
  }
}

/**
 * Access and manipulate the Vite config before it's applied.
 */
export function configureVite(hook: ConfigHook) {
  context.configHooks.push(hook)
}

type Route =
  | (() => Promise<RouteModule>)
  | Omit<RouteConfig, 'route' | 'keys' | 'pattern'>

type RouteMap = Record<string, Route> & {
  404?: () => Promise<RouteModule>
}

/**
 * Define routes and associate them with a module and optional params query.
 */
export function defineRoutes(routes: RouteMap) {
  for (const route in routes) {
    if (route === '404') {
      context.defaultRoute = routes[route]
      continue
    }
    const config = routes[route]
    const { keys, pattern } = regexParam(route)
    if (keys.length && (typeof config == 'function' || !config.query)) {
      logger.warn(`Dynamic route "${route}" has no "query" function`)
      continue
    }
    context.routes.push(
      typeof config == 'function'
        ? { import: config, route, keys, pattern }
        : { ...config, route, keys, pattern }
    )
  }

  // This is only for client-side routing.
  return {} as {
    [route: string]: () => Promise<RouteModule>
  }
}

export async function loadContext(
  root: string,
  configEnv: vite.ConfigEnv,
  logLevel: vite.LogLevel = 'error'
): Promise<Context> {
  const logger = vite.createLogger(logLevel)

  // Load "stite.yaml"
  const { render: renderPath, routes: routesPath } = readStiteYaml(root, logger)

  // Load "vite.config.ts"
  const loadResult = await vite.loadConfigFromFile(
    configEnv,
    undefined,
    root,
    logLevel
  )

  // Inject the logger
  const config = loadResult ? loadResult.config : {}
  config.customLogger = logger

  return {
    root,
    logger,
    config,
    configEnv,
    configPath: loadResult ? loadResult.path : null,
    configHooks: [],
    routesPath,
    routes: [],
    clients: {},
    renderPath,
    renderers: [],
    defaultRenderer: undefined,
  }
}

export function resetRenderHooks(ctx: Context, resetConfig?: boolean) {
  ctx.clients = {}
  ctx.renderers = []
  ctx.defaultRenderer = undefined
  if (resetConfig) {
    ctx.configHooks = []
  }
}

export async function loadModule(
  mod: string,
  ctx: Context,
  load: (url: string) => Promise<any>
) {
  context = ctx
  try {
    await load('/' + path.relative(ctx.root, mod))
  } finally {
    context = null as any
  }
}
