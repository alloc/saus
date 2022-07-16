import arrify from 'arrify'
import type { BuildContext, BundleContext } from '../bundle'
import type { DeployContext } from '../deploy'
import type { DevContext, DevMethods, DevState } from '../dev/context'
import type { RenderPageResult } from './app/types'
import { getSausPlugins } from './getSausPlugins'
import { loadResponseCache, setResponseCache } from './http/responseCache'
import { InjectedImports } from './injectModules'
import { CompileCache } from './node/compileCache'
import { toSausPath } from './paths'
import { ModuleProvider } from './plugins/moduleProvider'
import { PublicDirOptions } from './publicDir'
import { RouteClients } from './routeClients'
import { RouteRenderer } from './routeRenderer'
import { RoutesModule } from './routes'
import { clearCachedState } from './runtime/clearCachedState'
import { getCachedState } from './runtime/getCachedState'
import { Cache, withCache } from './runtime/withCache'
import type { Falsy } from './utils/types'
import { Plugin, ResolvedConfig, SausConfig, SausPlugin, vite } from './vite'
import { getConfigEnv, LoadedUserConfig, loadUserConfig } from './vite/config'
import { ViteFunctions } from './vite/functions'
import { PluginContainer } from './vite/pluginContainer'
import { RequireAsyncState } from './vm/asyncRequire'
import { RequireAsync } from './vm/types'

export type SausCommand = 'build' | 'serve' | 'deploy' | 'secrets'
export type SausContext = BuildContext | DeployContext | DevContext

/**
 * This context exists in both serve and build mode.
 */
export interface BaseContext
  extends RoutesModule,
    ViteFunctions,
    Required<RequireAsyncState>,
    Partial<DevState>,
    Partial<DevMethods> {
  /** The URL prefix for all pages */
  basePath: string
  /** Clear any matching pages (loading or loaded) */
  clearCachedPages: (filter?: string | ((key: string) => boolean)) => void
  command: SausCommand
  /** The cache for compiled SSR modules */
  compileCache: CompileCache
  config: ResolvedConfig
  configPath: string | undefined
  /** Path to the default layout */
  defaultLayout: { id: string; hydrated?: boolean }
  /** The `saus.defaultPath` option from Vite config */
  defaultPath: string
  /** Visit every cached page. Loading pages are waited for. */
  forCachedPages: (
    onPage: (pagePath: string, pageResult: RenderPageResult) => void
  ) => Promise<void>
  /** Load a page if not cached */
  getCachedPage: typeof getCachedState
  importMeta: Record<string, any>
  /**
   * Module paths that are auto-imported from the routes module
   * in a server context.
   *
   * These are injected via `saus.injectModules` hook.
   */
  injectedImports: InjectedImports
  logger: vite.Logger
  /** This provider is reset whenever the routes module is changed. */
  injectedModules: ModuleProvider
  pluginContainer: PluginContainer
  plugins: readonly SausPlugin[]
  publicDir: PublicDirOptions | null
  /**
   * Each "route renderer" consists of a layout module, a route module,
   * and the list of routes that use it.
   *
   * Note: This is undefined until `loadRoutes` is called.
   */
  renderers: RouteRenderer[]
  /**
   * Like `ssrRequire` but for Node.js modules.
   */
  require: RequireAsync
  /**
   * Use this instead of `this.config` when an extra Vite build is needed,
   * or else you risk corrupting the Vite plugin state.
   */
  resolveConfig: (inlineConfig?: vite.InlineConfig) => Promise<ResolvedConfig>
  root: string
  /**
   * Lazy generator of route clients.
   *
   * Note: This is undefined until `loadRoutes` is called.
   */
  routeClients: RouteClients
  /** Path to the routes module */
  routesPath: string
  /** Track which files are responsible for state modules */
  stateModulesByFile: Record<string, string[]>
  userConfig: vite.UserConfig
}

export type { DevContext, BuildContext, BundleContext, DeployContext }

type InlinePlugin = (
  sausConfig: SausConfig,
  configEnv: vite.ConfigEnv
) => Plugin | Plugin[]

type Context = Omit<BaseContext, keyof ViteFunctions>

async function createContext(props: {
  config: ResolvedConfig
  configPath: string | undefined
  command: SausCommand
  publicDir: PublicDirOptions | null
  resolveConfig: (inlineConfig?: vite.InlineConfig) => Promise<ResolvedConfig>
}): Promise<Context> {
  const { config } = props
  const pageCache: Cache<RenderPageResult> = {
    loading: {},
    loaders: {},
    loaded: {},
  }

  async function forCachedPages(
    onPage: (pagePath: string, pageResult: RenderPageResult) => void
  ): Promise<void> {
    const loaded = Object.entries(pageCache.loaded)
    const loading = Object.entries(pageCache.loading)
    for (const [pagePath, [pageResult]] of loaded) {
      onPage(pagePath, pageResult)
    }
    await Promise.all(
      loading.map(async ([pagePath, pagePromise]) => {
        onPage(pagePath, await pagePromise)
      })
    )
  }

  return {
    ...props,
    basePath: config.base,
    clearCachedPages: filter => clearCachedState(filter, pageCache),
    compileCache: new CompileCache('node_modules/.saus', config.root),
    defaultLayout: { id: config.saus.defaultLayoutId! },
    defaultPath: config.saus.defaultPath!,
    defaultState: [],
    externalExports: new Map(),
    forCachedPages,
    getCachedPage: withCache(pageCache),
    importMeta: config.env,
    injectedImports: {
      prepend: [],
      append: [],
    },
    injectedModules: null!,
    layoutEntries: new Set(),
    linkedModules: {},
    logger: config.logger,
    moduleMap: {},
    pluginContainer: null!,
    plugins: [],
    renderers: null!,
    require: null!,
    root: config.root,
    routeClients: null!,
    routes: [],
    routesPath: config.saus.routes,
    runtimeHooks: [],
    ssrRequire: null!,
    stateModulesByFile: {},
    userConfig: config.inlineConfig,
  }
}

/**
 * The following context properties must be initialized manually:
 *   - `injectedModules`
 *   - `pluginContainer`
 *   - `renderers`
 *   - `require`
 *   - `routeClients`
 *   - `ssrRequire`
 */
export async function loadContext<T extends Context>(
  command: SausCommand,
  defaultConfig: vite.InlineConfig = {},
  defaultPlugins?: (InlinePlugin | vite.Plugin | Falsy)[]
): Promise<T> {
  // The plugins created from the `inlinePlugins` argument
  // are shared between `resolveConfig` calls.
  let sharedPlugins: vite.Plugin[]

  const getUserConfig = async (inlineConfig?: vite.InlineConfig) => {
    let userConfig = await loadUserConfig(
      command,
      inlineConfig,
      // When loading the user config for the first time, we also want
      // to log how many config files were loaded from node_modules.
      inlineConfig == defaultConfig
        ? vite.createLogger(defaultConfig.logLevel)
        : undefined
    )

    // The `inlinePlugins` array is initialized once and its plugin
    // objects are reused by future `resolveConfig` calls.
    if (defaultPlugins && !sharedPlugins) {
      const configEnv = getConfigEnv(command, inlineConfig?.mode)
      sharedPlugins = (
        defaultPlugins.filter(Boolean) as (InlinePlugin | vite.Plugin)[]
      )
        .map(p => (typeof p == 'function' ? p(userConfig.saus, configEnv) : p))
        .flat()

      if (sharedPlugins.length)
        userConfig = vite.mergeConfig(
          { plugins: sharedPlugins },
          userConfig
        ) as typeof userConfig
    }

    return userConfig
  }

  const userConfig = await getUserConfig(defaultConfig)
  const configPath = userConfig.configFile

  const publicDir: PublicDirOptions | null =
    typeof userConfig.publicDir == 'object' ||
    typeof userConfig.publicDir == 'boolean'
      ? userConfig.publicDir || null
      : { root: userConfig.publicDir }

  const resolveConfig = async (
    userConfig: vite.InlineConfig | LoadedUserConfig
  ) => {
    const inlineConfig: vite.InlineConfig = {
      ...userConfig,
      configFile: false,
      publicDir: publicDir ? publicDir.root : false,
    }

    const configEnv = getConfigEnv(command, inlineConfig.mode)
    const config = (await vite.resolveConfig(
      inlineConfig,
      configEnv.command,
      configEnv.mode
    )) as ResolvedConfig

    // Since `resolveConfig` sets NODE_ENV for some reason,
    // we need to set it here to avoid SSR issues.
    process.env.NODE_ENV =
      config.mode == 'production' ? 'production' : undefined

    config.optimizeDeps.entries = [
      ...arrify(config.optimizeDeps.entries),
      // Skip "saus/client" in build mode, so we don't get warnings
      // from trying to resolve imports for modules included in the
      // bundled Saus runtime (see "../bundle/runtimeBundle.ts").
      ...arrify(command == 'serve' ? toSausPath('client/index.js') : undefined),
    ]

    return config
  }

  const config = await resolveConfig(userConfig)
  const context = await createContext({
    config,
    configPath,
    command,
    publicDir,
    async resolveConfig(inlineConfig) {
      inlineConfig = inlineConfig
        ? vite.mergeConfig(defaultConfig, inlineConfig)
        : defaultConfig
      const userConfig = await getUserConfig(inlineConfig)
      const config = await resolveConfig(userConfig)
      await getSausPlugins(context as any, config)
      if (sharedPlugins) {
        const plugins = config.plugins as vite.Plugin[]
        plugins.unshift(...sharedPlugins)
      }
      return config
    },
  })

  setResponseCache(loadResponseCache(userConfig.root!))
  return context as T
}
