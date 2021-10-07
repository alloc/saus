import path from 'path'
import callerPath from 'caller-path'
import * as RegexParam from 'regexparam'
import * as vite from 'vite'
import { readSausYaml } from './config'
import {
  PageRequest,
  RenderCall,
  Renderer,
  RenderedPage,
  RenderContext,
} from './render'
import {
  InferRouteParams,
  Route,
  RouteConfig,
  RouteModule,
  RouteParams,
  RouteLoader,
} from './routes'
import { UserConfig, SourceDescription } from './vite'

let context!: SausContext

export const getSausContext = () => context

export const logger = new Proxy({} as vite.Logger, {
  get(_, key: keyof vite.Logger) {
    return context.logger[key]
  },
})

export interface SausContext {
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
  routes: Route[]
  /** Rendered page cache */
  pages: Record<string, RenderedPage>
  /** The route used when no route is matched */
  defaultRoute?: Route
  /** Path to the render module */
  renderPath: string
  /** The renderers for specific routes */
  renderers: Renderer<string | null | void>[]
  /** The renderer used when no route is matched */
  defaultRenderer?: Renderer<string>
}

/** A generated client module */
export type Client = { id: string } & SourceDescription

/** Function that generates a client module */
export type ClientProvider = (
  context: SausContext,
  renderer: Renderer<string>
) => Client | Promise<Client | void> | void

export type ClientState = Record<string, any> & {
  rootId?: string
  routePath: string
  routeParams: RouteParams
  error?: any
}

export type ConfigHook = {
  (config: UserConfig, context: SausContext):
    | UserConfig
    | null
    | void
    | Promise<UserConfig | null | void>

  /** The module that added this hook. */
  modulePath?: string
}

type Promisable<T> = T | PromiseLike<T>

/**
 * Hook into the rendering process that generates HTML for a page.
 *
 * Return nothing to defer to the next renderer.
 */
export function render<
  Route extends string,
  Module extends object = RouteModule,
  State extends object = ClientState
>(
  route: Route,
  render: (
    module: Module,
    request: PageRequest<State, InferRouteParams<Route>>,
    context: RenderContext
  ) => Promisable<string | null | void>,
  ...metadata: any[]
): RenderCall

/** Set the fallback renderer. */
export function render<
  Module extends object = RouteModule,
  State extends object = ClientState
>(
  render: (
    module: Module,
    request: PageRequest<State>,
    context: RenderContext
  ) => Promisable<string>,
  ...metadata: any[]
): RenderCall

export function render(...args: [any, any?]) {
  let renderer: Renderer<any>
  if (typeof args[0] === 'string') {
    renderer = new Renderer(...args)
    context.renderers.push(renderer)
  } else {
    renderer = new Renderer('', ...args)
    context.defaultRenderer = renderer
  }
  return new RenderCall(renderer)
}

/**
 * Access and manipulate the Vite config before it's applied.
 */
export function configureVite(hook: ConfigHook) {
  hook.modulePath = callerPath()
  context.configHooks.push(hook)
}

const importRE = /\b__vite_ssr_dynamic_import__\(["']([^"']+)["']\)/
const parseDynamicImport = (fn: Function) => importRE.exec(fn.toString())![1]

/** Define a route */
export function route<RoutePath extends string, Module extends object>(
  path: RoutePath,
  load: RouteLoader<Module>,
  config?: RouteConfig<Module, InferRouteParams<RoutePath>>
): void

/** Define the default route */
export function route(load: RouteLoader): void

/** @internal */
export function route(
  pathOrLoad: string | RouteLoader,
  maybeLoad?: RouteLoader<any>,
  config?: RouteConfig<any, any>
) {
  const path = typeof pathOrLoad == 'string' ? pathOrLoad : 'default'
  const load = maybeLoad || (pathOrLoad as RouteLoader)
  const route = {
    path,
    load,
    moduleId: parseDynamicImport(load),
    ...config,
  } as Route

  if (path === 'default') {
    route.keys = []
    route.pattern = /./
    context.defaultRoute = route
  } else {
    Object.assign(route, RegexParam.parse(path))
    context.routes.push(route)
  }
}

export async function loadContext(
  command: 'serve' | 'build',
  inlineConfig?: vite.UserConfig,
  sausPlugins?: ((context: SausContext) => vite.Plugin)[]
): Promise<SausContext> {
  const root = inlineConfig?.root || process.cwd()
  const configEnv: vite.ConfigEnv = {
    command,
    mode:
      inlineConfig?.mode ||
      (command === 'build' ? 'production' : 'development'),
  }

  const logLevel = inlineConfig?.logLevel || 'info'
  const logger = vite.createLogger(logLevel)

  // Load "saus.yaml"
  const { render: renderPath, routes: routesPath } = readSausYaml(root, logger)

  // Load "vite.config.ts"
  const loadResult = await vite.loadConfigFromFile(
    configEnv,
    undefined,
    root,
    logLevel
  )

  const userConfig = loadResult ? loadResult.config : {}
  userConfig.mode ??= configEnv.mode

  let config = vite.mergeConfig(userConfig, <vite.UserConfig>{
    configFile: false,
    customLogger: logger,
    esbuild: userConfig.esbuild !== false && {
      target: userConfig.esbuild?.target || 'node14',
    },
    ssr: {
      noExternal: ['saus/client'],
    },
    optimizeDeps: {
      entries: [renderPath, routesPath],
      exclude: ['saus'],
    },
  })

  if (inlineConfig) {
    config = vite.mergeConfig(config, inlineConfig)
  }

  const context: SausContext = {
    root,
    logger,
    config,
    configEnv,
    configPath: loadResult ? loadResult.path : null,
    configHooks: [],
    routesPath,
    routes: [],
    pages: {},
    renderPath,
    renderers: [],
    defaultRenderer: undefined,
  }

  await loadConfigHooks(context)
  for (const hook of context.configHooks) {
    const result = await hook(config, context)
    if (result) {
      config = vite.mergeConfig(config, result)
    }
  }

  // Renderer hooks must be loaded *after* config hooks
  // have been applied.
  resetRenderHooks(context)

  if (sausPlugins) {
    config.plugins ||= []
    config.plugins.unshift(sausPlugins.map(p => p(context)))
  }

  context.config = config
  return context
}

export function resetRenderHooks(ctx: SausContext, resetConfig?: boolean) {
  Object.keys(ctx.pages).forEach(key => {
    delete ctx.pages[key]
  })
  ctx.renderers.length = 0
  ctx.defaultRenderer = undefined
  if (resetConfig) {
    ctx.configHooks.length = 0
  }
}

export function resetConfigModules(ctx: SausContext) {
  for (const hook of ctx.configHooks) {
    if (hook.modulePath) {
      delete require.cache[hook.modulePath]
    }
  }
}

type ModuleLoader = vite.ViteDevServer

export async function loadModule(
  mod: string,
  ctx: SausContext,
  loader: ModuleLoader
) {
  context = ctx
  try {
    await loader.ssrLoadModule('/' + path.relative(ctx.root, mod))
  } finally {
    context = null as any
  }
}

export function loadRoutes(context: SausContext, loader: ModuleLoader) {
  return loadModule(context.routesPath, context, loader)
}

export function loadRenderHooks(context: SausContext, loader: ModuleLoader) {
  return loadModule(context.renderPath, context, loader)
}

export async function loadConfigHooks(context: SausContext) {
  const loader = await createLoader(context, {
    cacheDir: false,
  })
  context.configHooks = []
  await loadRenderHooks(context, loader)
  await loader.close()
}

export function createLoader(
  context: SausContext,
  inlineConfig?: UserConfig
): Promise<ModuleLoader> {
  return vite.createServer({
    ...context.config,
    ...inlineConfig,
    logLevel: 'error',
    server: {
      ...inlineConfig?.server,
      middlewareMode: 'ssr',
    },
  })
}
