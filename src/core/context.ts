import arrify from 'arrify'
import { resolve } from 'path'
import { loadResponseCache, setResponseCache } from '../http/responseCache'
import type { RenderPageResult } from '../pages/types'
import { clearCachedState } from '../runtime/clearCachedState'
import { getCachedState } from '../runtime/getCachedState'
import { CompileCache } from '../utils/CompileCache'
import { Deferred } from '../utils/defer'
import { relativeToCwd } from '../utils/relativeToCwd'
import { ConfigHook, ConfigHookRef } from './config'
import { debug } from './debug'
import { getSausPlugins } from './getSausPlugins'
import { loadConfigHooks } from './loadConfigHooks'
import { toSausPath } from './paths'
import { RenderModule } from './render'
import { RoutesModule } from './routes'
import { Plugin, ResolvedConfig, SausConfig, SausPlugin, vite } from './vite'
import { Cache, withCache } from './withCache'

export interface SausContext extends RenderModule, RoutesModule {
  root: string
  plugins: readonly SausPlugin[]
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
  /** Get all cached pages. Loading pages are waited for. */
  getCachedPages: () => Promise<Map<string, RenderPageResult>>
  /** Clear any matching pages (loading or loaded) */
  clearCachedPages: (filter?: string | ((key: string) => boolean)) => void
  /** Path to the render module */
  renderPath: string
  /** For checking if a page is outdated since rendering began */
  reloadId: number
  /** Wait to serve pages until hot reloading completes */
  reloading?: Deferred<void>
  /** Exists in dev mode only */
  server?: vite.ViteDevServer
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
  const pageCache: Cache<RenderPageResult> = {
    loading: {},
    loaders: {},
    loaded: {},
  }

  async function getCachedPages() {
    const loaded = Object.entries(pageCache.loaded)
    const loading = Object.entries(pageCache.loading)
    const justLoaded = await Promise.all(loading.map(e => e[1]))
    const cachedPages = new Map<string, RenderPageResult>()
    for (const [pagePath, [pageResult]] of loaded) {
      cachedPages.set(pagePath, pageResult)
    }
    justLoaded.forEach((pageResult, i) => {
      cachedPages.set(loading[i][0], pageResult)
    })
    return cachedPages
  }

  return {
    root: config.root,
    plugins: [],
    logger: config.logger,
    config,
    configPath: config.configFile,
    configHooks,
    userConfig: config.inlineConfig,
    resolveConfig,
    compileCache: new CompileCache('node_modules/.saus', config.root),
    basePath: config.base,
    defaultPath: config.saus.defaultPath!,
    routesPath: config.saus.routes,
    routes: [],
    runtimeHooks: [],
    defaultState: [],
    stateModulesByFile: {},
    getCachedPage: withCache(pageCache),
    clearCachedPages: filter => clearCachedState(filter, pageCache),
    getCachedPages,
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
    async config =>
      context?.configHooks || (configHooks = await loadConfigHooks(config)),
    config => (context ||= createContext(config, configHooks, resolveConfig))
  )

  await resolveConfig(command)

  setResponseCache(loadResponseCache(context!.root))
  return context!
}

function getConfigResolver(
  defaultConfig: vite.InlineConfig,
  inlinePlugins: InlinePlugin[] | undefined,
  getConfigHooks: (config: ResolvedConfig) => Promise<ConfigHookRef[]>,
  getContext: (config: ResolvedConfig) => SausContext
) {
  return async (
    command: 'build' | 'serve',
    inlineConfig?: vite.InlineConfig
  ) => {
    const isBuild = command == 'build'
    const sausDefaults: vite.InlineConfig = {
      configFile: false,
      server: {
        preTransformRequests: !isBuild,
        fs: {
          allow: [toSausPath('')],
        },
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
    }

    inlineConfig = vite.mergeConfig(
      sausDefaults,
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
    sausConfig.defaultPath ||= '/404'

    if (inlinePlugins) {
      userConfig.plugins ??= []
      userConfig.plugins.unshift(
        ...inlinePlugins.map(create => create(sausConfig, configEnv))
      )
    }

    const configHooks = await getConfigHooks(userConfig as any)
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
      if (process.env.DEBUG) {
        debug(`Applied config hook: %O`, relativeToCwd(hookRef.path))
      }
    }

    const config = (await vite.resolveConfig(
      userConfig,
      command,
      defaultMode
    )) as ResolvedConfig

    // @ts-ignore
    config.configFile = loadResult.path

    // The render module and "saus/client" need their deps optimized.
    config.optimizeDeps.entries = [
      sausConfig.render,
      ...arrify(config.optimizeDeps.entries),
      // Skip "saus/client" in build mode, so we don't get warnings
      // from trying to resolve imports for modules included in the
      // bundled Saus runtime (see "./bundle/runtimeBundle.ts").
      ...arrify(isBuild ? undefined : toSausPath('client/index.js')),
    ]

    const context = getContext(config)

    // In build mode, we create Saus plugins *before* routes load,
    // whereas, in dev mode, they're created *after* that.
    if (config.command == 'build') {
      context.plugins = await getSausPlugins(context, config)
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
