import path from 'path'
import callerPath from 'caller-path'
import { transformSync } from '../babel'
import type { RenderedPage } from '../pages'
import { readSausYaml } from './config'
import type { Renderer } from './renderer'
import type { Route } from './routes'
import { UserConfig, vite } from './vite'
import { context, setContext } from './global'

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

export type ConfigHook = {
  (config: UserConfig, context: SausContext):
    | UserConfig
    | null
    | void
    | Promise<UserConfig | null | void>

  /** The module that added this hook. */
  modulePath?: string
}

/**
 * Access and manipulate the Vite config before it's applied.
 */
export function configureVite(hook: ConfigHook) {
  hook.modulePath = callerPath()
  context.configHooks.push(hook)
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

export function resetRenderHooks(context: SausContext, resetConfig?: boolean) {
  Object.keys(context.pages).forEach(key => {
    delete context.pages[key]
  })
  context.renderers.length = 0
  context.defaultRenderer = undefined
  if (resetConfig) {
    context.configHooks.length = 0
  }
}

export function resetConfigModules(context: SausContext) {
  for (const hook of context.configHooks) {
    if (hook.modulePath) {
      delete require.cache[hook.modulePath]
    }
  }
}

export interface ModuleLoader extends vite.ViteDevServer {}

function loadModules(
  url: string | string[],
  context: SausContext,
  loader: ModuleLoader
) {
  if (!Array.isArray(url)) {
    url = [url]
  }
  return loader.ssrLoadModule(
    url.map(url => '/' + path.relative(context.root, url))
  )
}

/** Load routes and renderers for the current Saus context. */
export async function loadRoutes(loader: ModuleLoader) {
  const modules: string[] = []
  if (!context.routes.length) {
    modules.push(context.routesPath)
  }
  if (!context.renderers.length && !context.defaultRenderer) {
    modules.push(context.renderPath)
  }
  await loadModules(modules, context, loader)
}

export async function loadConfigHooks(context: SausContext) {
  const loader = await createLoader(context, {
    plugins: [stripRelativeImports(context)],
    cacheDir: false,
    server: { hmr: false, wss: false },
  })
  context.configHooks = []
  setContext(context)
  try {
    await loadModules(context.renderPath, context, loader)
  } finally {
    setContext(null)
  }
  await loader.close()
}

// Top-level statements in project-specific modules could rely
// on Vite plugins injected by a renderer package, so we need
// to avoid evaluating those modules until Vite is configured.
const stripRelativeImports = (context: SausContext): vite.Plugin => ({
  name: 'saus:strip-relative-imports',
  transform(code, id) {
    if (id == context.renderPath) {
      return transformSync(code, id, [
        {
          visitor: {
            ImportDeclaration(decl) {
              const source = decl.get('source').node.value
              if (/^\.\.?\//.test(source)) {
                decl.remove()
              }
            },
          },
        },
      ]) as vite.TransformResult
    }
  },
})

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
