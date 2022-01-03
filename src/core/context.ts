import * as esModuleLexer from 'es-module-lexer'
import fs from 'fs'
import Module from 'module'
import { resolve } from 'path'
import type { RenderedPage } from '../pages'
import { Profiling } from '../profiling'
import { Deferred } from '../utils/defer'
import { ClientState } from './client'
import { ConfigHook, SausCommand, setConfigHooks } from './config'
import { HtmlContext } from './html'
import { RenderModule } from './render'
import { RoutesModule } from './routes'
import { SausConfig, UserConfig, vite } from './vite'

export interface SausContext extends RenderModule, RoutesModule, HtmlContext {
  root: string
  logger: vite.Logger
  config: UserConfig
  configEnv: vite.ConfigEnv
  configPath: string | null
  configHooks: string[]
  /** The URL prefix for all pages */
  basePath: string
  /** The `saus.defaultPath` option from Vite config */
  defaultPath: string
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
  command: SausCommand,
  inlineConfig?: vite.UserConfig,
  sausPlugins?: ((context: SausContext) => vite.Plugin)[]
): Promise<SausContext> {
  const root = vite
    .normalizePath(inlineConfig?.root || process.cwd())
    .replace(/\/$/, '')

  const isBuild = command === 'build'
  const configEnv: vite.ConfigEnv = {
    command: command !== 'dev' ? 'build' : 'serve',
    mode: inlineConfig?.mode || (isBuild ? 'production' : 'development'),
  }

  const logLevel = inlineConfig?.logLevel || 'info'
  const logger = vite.createLogger(logLevel)

  Profiling.mark('load user config')

  // Load "vite.config.ts"
  const loadResult = await vite.loadConfigFromFile(
    configEnv,
    undefined,
    root,
    logLevel
  )

  const userConfig = loadResult ? loadResult.config : {}
  userConfig.mode ??= configEnv.mode

  const sausConfig = userConfig.saus
  assertSausConfig(sausConfig)
  assertSausConfig(sausConfig, 'render')
  assertSausConfig(sausConfig, 'routes')

  const renderPath = resolve(root, sausConfig.render)
  const routesPath = resolve(root, sausConfig.routes)

  const overrides: vite.InlineConfig = {
    configFile: false,
    customLogger: logger,
    server: {
      lazyTransform: isBuild,
    },
    ssr: {
      noExternal: ['saus/client'],
    },
    optimizeDeps: {
      entries: [renderPath],
      exclude: ['saus'],
    },
  }

  let config = vite.mergeConfig(userConfig, overrides) as vite.UserConfig
  if (inlineConfig) {
    config = vite.mergeConfig(config, inlineConfig)
  }

  const context: SausContext = {
    root,
    logger,
    config: config as UserConfig,
    configEnv,
    configPath: loadResult ? loadResult.path : null,
    configHooks: [],
    basePath: config.base || '/',
    defaultPath: sausConfig.defaultPath || '/404',
    routesPath,
    routes: [],
    runtimeHooks: [],
    pages: {},
    states: {},
    renderPath,
    renderers: [],
    beforeRenderHooks: [],
    reloadId: 0,
  }

  Profiling.mark('load config hooks')

  context.configHooks = await loadConfigHooks(context.renderPath)

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

  context.config = config as UserConfig

  return context
}

function assertSausConfig(
  config: Partial<SausConfig> | undefined
): asserts config is SausConfig

function assertSausConfig(
  config: Partial<SausConfig>,
  prop: keyof SausConfig
): void

function assertSausConfig(
  config: Partial<SausConfig> | undefined,
  prop?: keyof SausConfig
) {
  const value = prop ? config![prop] : config
  if (!value) {
    const keyPath = 'saus' + (prop ? '.' + prop : '')
    throw Error(
      `[saus] You must define the "${keyPath}" property in your Vite config`
    )
  }
}

export interface ModuleLoader extends vite.ViteDevServer {}

export async function loadConfigHooks(importer: string) {
  const require = Module.createRequire(importer)
  const code = fs
    .readFileSync(importer, 'utf8')
    .split('\n')
    .filter(line => line.startsWith('import '))
    .join('\n')

  await esModuleLexer.init
  const [imports] = esModuleLexer.parse(code, importer)

  const configHooks: string[] = []
  setConfigHooks(configHooks)

  for (const imp of imports) {
    const moduleId = imp.n!
    // Skip relative imports
    if (moduleId[0] == '.') {
      continue
    }
    try {
      // In the case of failed module resolution, we swallow the error
      // and assume the module in question relies on Vite resolution,
      // which means it can't provide a config hook.
      const modulePath = require.resolve(moduleId)

      delete require.cache[modulePath]
      try {
        require(modulePath)
      } catch (e) {
        console.error(e)
      }
    } catch {}
  }

  setConfigHooks(null)
  return configHooks
}

export function createLoader(
  context: SausContext,
  inlineConfig?: vite.UserConfig
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
