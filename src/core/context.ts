import callerPath from 'caller-path'
import { getImportDeclarations, transformSync } from '../babel'
import type { RenderedPage } from '../pages'
import { readSausYaml } from './config'
import { UserConfig, vite } from './vite'
import { RenderModule } from './render'
import { RoutesModule } from './routes'
import { Deferred } from '../utils/defer'
import { renderModule, setRenderModule } from './global'
import { ssrCreateContext } from 'vite'

export interface SausContext extends RenderModule, RoutesModule {
  root: string
  logger: vite.Logger
  config: UserConfig
  configEnv: vite.ConfigEnv
  configPath: string | null
  /** Path to the routes module */
  routesPath: string
  /** Rendered page cache */
  pages: Record<string, RenderedPage>
  /** Path to the render module */
  renderPath: string
  /** The SSR context used when loading routes */
  ssrContext?: vite.SSRContext
  /** Wait to serve pages until hot reloading completes */
  reloading?: Deferred<void>
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
  renderModule.configHooks.push(hook)
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
      entries: [renderPath],
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
    beforeRenderHooks: [],
  }

  await loadConfigHooks(context)
  for (const hook of context.configHooks) {
    const result = await hook(config, context)
    if (result) {
      config = vite.mergeConfig(config, result)
    }
  }

  if (sausPlugins) {
    config.plugins ||= []
    config.plugins.unshift(sausPlugins.map(p => p(context)))
  }

  context.config = config
  return context
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
    url.map(url => url.replace(context.root, '')),
    context.ssrContext
  )
}

export async function loadConfigHooks(context: SausContext) {
  const loader = await createLoader(context, {
    plugins: [stripRelativeImports(context)],
    cacheDir: false,
    server: { hmr: false, wss: false, watch: false },
  })
  context.ssrContext = ssrCreateContext(loader)
  context.configHooks = []
  setRenderModule(context)
  try {
    await loadModules(context.renderPath, context, loader)
  } finally {
    setRenderModule(null)
    context.ssrContext = undefined
  }
  context.beforeRenderHooks.length = 0
  context.renderers.length = 0
  context.defaultRenderer = undefined
  await loader.close()
}

// Top-level statements in project-specific modules could rely
// on Vite plugins injected by a renderer package, so we need
// to avoid evaluating those modules until Vite is configured.
const stripRelativeImports = (context: SausContext): vite.Plugin => ({
  name: 'saus:strip-relative-imports',
  transform(code, importer) {
    if (importer == context.renderPath) {
      const { isExternal } = context.ssrContext!
      return transformSync(code, importer, [
        {
          visitor: {
            Program(program) {
              for (const decl of getImportDeclarations(program)) {
                const source = decl.get('source').node.value
                const isRelative = /^\.\.?\//.test(source)
                if (isRelative || !isExternal(source)) {
                  decl.remove()
                }
              }
            },
          },
        },
      ]) as Promise<vite.TransformResult>
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

export function resetConfigModules(context: SausContext) {
  for (const hook of context.configHooks) {
    if (hook.modulePath) {
      delete require.cache[hook.modulePath]
    }
  }
}
