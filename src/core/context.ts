import { ssrCreateContext } from 'vite'
import { getImportDeclarations, transformSync } from '../babel'
import type { RenderedPage } from '../pages'
import { Deferred } from '../utils/defer'
import { ClientState } from './client'
import { readSausYaml } from '../config'
import { RenderModule } from './render'
import { RoutesModule } from './routes'
import { UserConfig, vite } from './vite'
import { ConfigHook, setConfigHooks } from './config'
import { setRenderModule } from './global'

export interface SausContext extends RenderModule, RoutesModule {
  root: string
  logger: vite.Logger
  config: UserConfig
  configEnv: vite.ConfigEnv
  configPath: string | null
  configHooks: string[]
  /** Path to the routes module */
  routesPath: string
  /** Rendered page cache */
  pages: Record<string, RenderedPage>
  /** Client state cache */
  states: Record<string, Deferred<ClientState>>
  /** Path to the render module */
  renderPath: string
  /** The SSR context used when loading routes */
  ssrContext?: vite.SSRContext
  /** For checking if a page is outdated since rendering began */
  reloadId: number
  /** Wait to serve pages until hot reloading completes */
  reloading?: Deferred<void>
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
    states: {},
    renderPath,
    renderers: [],
    beforeRenderHooks: [],
    reloadId: 0,
  }

  await loadConfigHooks(context)
  for (const hookPath of context.configHooks) {
    const hookModule = require(hookPath)
    const configHook: ConfigHook = hookModule.__esModule
      ? hookModule.default
      : hookModule

    const result = await (typeof configHook == 'function'
      ? configHook(config, configEnv)
      : configHook)

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

  // Populate an object that will be thrown away immediately,
  // because we need the config hooks applied before the
  // renderers are usable.
  setRenderModule({
    beforeRenderHooks: [],
    renderers: [],
  })

  context.ssrContext = ssrCreateContext(loader)
  setConfigHooks((context.configHooks = []))
  try {
    await loadModules(context.renderPath, context, loader)
  } finally {
    setConfigHooks(null)
    setRenderModule(null)
    context.ssrContext = undefined
  }

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
