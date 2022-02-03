import { flatten } from 'array-flatten'
import arrify from 'arrify'
import esModuleLexer from 'es-module-lexer'
import fs from 'fs'
import Module from 'module'
import { resolve } from 'path'
import { clearState } from '../runtime/clearState'
import { getCachedState } from '../runtime/getCachedState'
import { callPlugins } from '../utils/callPlugins'
import { CompileCache } from '../utils/CompileCache'
import { Deferred } from '../utils/defer'
import { plural } from '../utils/plural'
import { ConfigHook, ConfigHookRef, setConfigHooks } from './config'
import { debug } from './debug'
import { HtmlContext } from './html'
import { RenderModule } from './render'
import { RoutesModule } from './routes'
import { Plugin, SausConfig, SausPlugin, vite } from './vite'
import { withCache } from './withCache'

type ResolvedConfig = vite.ResolvedConfig & {
  readonly saus: Readonly<SausConfig>
}

export interface SausContext extends RenderModule, RoutesModule, HtmlContext {
  root: string
  plugins: readonly ({ name: string } & SausPlugin)[]
  logger: vite.Logger
  config: ResolvedConfig
  configPath: string | undefined
  configHooks: ConfigHookRef[]
  userConfig: vite.UserConfig
  /**
   * Use this instead of `this.config` when an extra Vite build is needed,
   * or else you risk corrupting the Vite plugin state.
   */
  resolveConfig: (
    command: 'build' | 'serve',
    inlineConfig?: vite.UserConfig
  ) => Promise<ResolvedConfig>
  /** Only exists in dev mode */
  server?: vite.ViteDevServer
  /** The cache for compiled SSR modules */
  compileCache: CompileCache
  /** The URL prefix for all pages */
  basePath: string
  /** The `saus.defaultPath` option from Vite config */
  defaultPath: string
  /** Path to the routes module */
  routesPath: string
  /** Track which files are responsible for state modules */
  stateModulesByFile: Record<string, string[]>
  /** Load a page if not cached */
  getCachedPage: typeof getCachedState
  /** Clear any matching pages (loading or loaded) */
  clearCachedPages: (filter?: string | ((key: string) => boolean)) => void
  /** Path to the render module */
  renderPath: string
  /** For checking if a page is outdated since rendering began */
  reloadId: number
  /** Wait to serve pages until hot reloading completes */
  reloading?: Deferred<void>
}

type InlinePlugin = (
  sausConfig: SausConfig,
  configEnv: vite.ConfigEnv
) => Plugin | Plugin[]

function createContext(
  config: ResolvedConfig,
  configHooks: ConfigHookRef[],
  resolveConfig: SausContext['resolveConfig']
): SausContext {
  // This cache is only for rendered pages. State modules use the global cache.
  const localCache: typeof import('../runtime/cache') = {
    loadingStateCache: new Map(),
    loadedStateCache: new Map(),
  }

  return {
    root: config.root,
    plugins: getSausPlugins(config),
    logger: config.logger,
    config,
    configPath: config.configFile,
    configHooks,
    userConfig: config.inlineConfig,
    resolveConfig,
    compileCache: new CompileCache('node_modules/.ssr', config.root),
    basePath: config.base,
    defaultPath: config.saus.defaultPath || '/404',
    routesPath: config.saus.routes,
    routes: [],
    runtimeHooks: [],
    defaultState: [],
    stateModulesByFile: {},
    getCachedPage: withCache(localCache),
    clearCachedPages: filter => clearState(filter, localCache),
    renderPath: config.saus.render,
    renderers: [],
    beforeRenderHooks: [],
    reloadId: 0,
  }
}

export async function loadContext(
  command: 'build' | 'serve',
  inlineConfig?: vite.InlineConfig,
  inlinePlugins?: InlinePlugin[]
): Promise<SausContext> {
  let context: SausContext | undefined
  let configHooks: ConfigHookRef[]

  const resolveConfig = getConfigResolver(
    inlineConfig || {},
    inlinePlugins,
    async renderPath =>
      context?.configHooks || (configHooks = await loadConfigHooks(renderPath)),
    config => (context ||= createContext(config, configHooks, resolveConfig))
  )

  await resolveConfig(command)
  return context!
}

const getSausPlugins = (config: vite.ResolvedConfig) =>
  flattenPlugins(config.plugins as Plugin[], p => {
    if (!p || !p.saus) {
      return false
    }
    if (typeof p.apply == 'function') {
      return p.apply(config.inlineConfig, {
        command: config.command,
        mode: config.mode,
      })
    }
    return !p.apply || p.apply == config.command
  }).map(p => ({
    name: p.name,
    ...p.saus,
  }))

function flattenPlugins<T extends vite.Plugin>(
  plugins: readonly T[],
  filter?: (p: T) => any
) {
  const filtered: vite.Plugin[] = filter ? plugins.filter(filter) : [...plugins]
  return flatten(vite.sortUserPlugins(filtered)) as T[]
}

function getConfigResolver(
  defaultConfig: vite.InlineConfig,
  inlinePlugins: InlinePlugin[] | undefined,
  getConfigHooks: (renderPath: string) => Promise<ConfigHookRef[]>,
  getContext: (config: ResolvedConfig) => SausContext
) {
  return async (
    command: 'build' | 'serve',
    inlineConfig?: vite.InlineConfig
  ) => {
    const isBuild = command == 'build'

    inlineConfig = vite.mergeConfig(
      {
        configFile: false,
        server: {
          preTransformRequests: !isBuild,
        },
        ssr: {
          noExternal: isBuild ? true : ['saus/client'],
        },
        build: {
          ssr: true,
        },
        optimizeDeps: {
          exclude: ['saus'],
        },
      },
      inlineConfig
        ? vite.mergeConfig(defaultConfig, inlineConfig)
        : defaultConfig
    )

    const defaultMode = isBuild ? 'production' : 'development'
    const configEnv: vite.ConfigEnv = {
      command,
      mode: inlineConfig.mode || defaultMode,
    }

    const root = (inlineConfig.root = vite
      .normalizePath(resolve(inlineConfig.root || './'))
      .replace(/\/$/, ''))

    const loadResult = await vite.loadConfigFromFile(
      configEnv,
      undefined,
      inlineConfig.root,
      inlineConfig.logLevel
    )

    if (!loadResult) {
      throw Error(`[saus] No "vite.config.js" file was found`)
    }

    let userConfig: vite.UserConfig = vite.mergeConfig(
      loadResult.config,
      inlineConfig
    )

    const sausConfig = userConfig.saus
    assertSausConfig(sausConfig)
    assertSausConfig(sausConfig, 'render')
    assertSausConfig(sausConfig, 'routes')
    sausConfig.render = resolve(root, sausConfig.render)
    sausConfig.routes = resolve(root, sausConfig.routes)

    if (inlinePlugins) {
      userConfig.plugins ??= []
      userConfig.plugins.unshift(
        ...inlinePlugins.map(create => create(sausConfig, configEnv))
      )
    }

    const configHooks = await getConfigHooks(sausConfig.render)
    debug(`Found ${plural(configHooks.length, 'config hook')}`)

    for (const hookRef of configHooks) {
      const hookModule = require(hookRef.path)
      const configHook: ConfigHook = hookModule.__esModule
        ? hookModule.default
        : hookModule

      if (typeof configHook !== 'function')
        throw Error(
          `[saus] Config hook must export a function: ${hookRef.path}`
        )

      const result = await configHook(userConfig, configEnv)
      if (result) {
        userConfig = vite.mergeConfig(userConfig, result)
      }
      debug(`Applied config hook: ${hookRef.path}`)
    }

    const config = (await vite.resolveConfig(
      userConfig,
      command,
      defaultMode
    )) as ResolvedConfig

    config.optimizeDeps.entries = [
      ...arrify(config.optimizeDeps.entries),
      sausConfig.render,
      resolve(__dirname, '../client/index.js'),
    ]

    const context = getContext(config)
    const sausPlugins = getSausPlugins(config)
    context.plugins ||= sausPlugins

    // In build mode, call `onContext` hooks right after `configResolved` hooks.
    // In serve mode, routes are loaded before `onContext` hooks are called.
    if (config.command == 'build') {
      await callPlugins(sausPlugins, 'onContext', context)
    }

    return config
  }
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

export async function loadConfigHooks(
  importer: string,
  oldConfigHooks?: ConfigHookRef[]
) {
  const require = Module.createRequire(importer)
  const code = fs
    .readFileSync(importer, 'utf8')
    .split('\n')
    .filter(line => line.startsWith('import '))
    .join('\n')

  await esModuleLexer.init
  const [imports] = esModuleLexer.parse(code, importer)

  const configHooks: ConfigHookRef[] = []
  setConfigHooks(configHooks)

  for (const imp of imports) {
    let moduleId = imp.n!

    // Skip relative imports
    if (moduleId[0] == '.') {
      continue
    }

    // In the case of failed module resolution, we swallow the error
    // and assume the module in question relies on Vite resolution,
    // which means it can't provide a config hook.
    try {
      moduleId = require.resolve(moduleId)
    } catch {
      continue
    }

    if (moduleId.endsWith('.js')) {
      if (oldConfigHooks) {
        const module = require.cache[moduleId]
        module && resetHookSources(module, oldConfigHooks)
      }
      try {
        require(moduleId)
      } catch (e: any) {
        // Ignore non-CJS modules
        if (!e.message.startsWith('Cannot use import')) {
          console.error(e)
        }
      }
    }
  }

  setConfigHooks(null)
  return configHooks
}

function resetHookSources(
  module: NodeModule,
  configHooks: ConfigHookRef[],
  resetCache = new Map<NodeModule, boolean>()
) {
  let needsReset = resetCache.get(module)
  if (needsReset !== undefined) {
    return needsReset
  }
  needsReset = configHooks.some(hook => hook.source == module.filename)
  resetCache.set(module, needsReset)
  for (const child of module.children) {
    if (resetHookSources(child, configHooks, resetCache)) {
      needsReset = true
    }
  }
  if (needsReset) {
    delete require.cache[module.filename]
  }
  return needsReset
}
