import arrify from 'arrify'
import type { BuildContext, BundleContext } from '../bundle'
import type { DeployContext } from '../deploy'
import type { DevContext, DevMethods, DevState } from '../dev/context'
import type { RenderPageResult } from './app/types'
import { HtmlContext } from './html'
import { loadResponseCache, setResponseCache } from './http/responseCache'
import { CompileCache } from './node/compileCache'
import { toSausPath } from './paths'
import { PublicDirOptions } from './publicDir'
import { RouteClients } from './routeClients'
import { RoutesModule } from './routes'
import { clearCachedState } from './runtime/clearCachedState'
import { getCachedState } from './runtime/getCachedState'
import { Cache, withCache } from './runtime/withCache'
import { Plugin, ResolvedConfig, SausConfig, SausPlugin, vite } from './vite'
import { getConfigEnv, loadUserConfig } from './vite/config'
import { ViteFunctions } from './vite/functions'
import { PluginContainer } from './vite/pluginContainer'
import { RequireAsyncState } from './vm/asyncRequire'
import { RequireAsync } from './vm/types'

export type SausCommand = SausContext['command']
export type SausContext = BuildContext | DeployContext | DevContext

/**
 * This context exists in both serve and build mode.
 */
export interface BaseContext
  extends RoutesModule,
    HtmlContext,
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
  logger: vite.Logger
  pluginContainer: PluginContainer
  plugins: readonly SausPlugin[]
  publicDir: PublicDirOptions | null
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
  /** Lazy generator of route clients */
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
    configPath: config.configFile,
    defaultLayout: { id: config.saus.defaultLayoutId! },
    defaultPath: config.saus.defaultPath!,
    defaultState: [],
    externalExports: new Map(),
    forCachedPages,
    getCachedPage: withCache(pageCache),
    layoutEntries: new Set(),
    linkedModules: {},
    logger: config.logger,
    moduleMap: {},
    pluginContainer: null!,
    plugins: [],
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
 *   - `pluginContainer`
 *   - `routeClients`
 *   - `require`
 *   - `ssrRequire`
 */
export async function loadContext<T extends Context>(
  command: SausCommand,
  inlineConfig: vite.InlineConfig = {},
  inlinePlugins?: InlinePlugin[]
): Promise<T> {
  let userConfig = await loadUserConfig(command, inlineConfig)
  if (inlinePlugins) {
    const configEnv = getConfigEnv(command, inlineConfig.mode)
    const plugins = inlinePlugins.map(p => p(userConfig.saus, configEnv))
    userConfig = vite.mergeConfig({ plugins }, userConfig) as any
  }

  const publicDir: PublicDirOptions | null =
    typeof userConfig.publicDir == 'object' ||
    typeof userConfig.publicDir == 'boolean'
      ? userConfig.publicDir || null
      : { root: userConfig.publicDir }

  const resolveConfig = async (inlineConfig?: vite.InlineConfig) => {
    const inServeMode = command == 'serve'
    const config = (await vite.resolveConfig(
      {
        ...userConfig,
        // Vite expects a string, false, or undefined.
        publicDir: publicDir ? publicDir.root : false,
      },
      inServeMode ? command : 'build',
      inServeMode ? 'development' : 'production'
    )) as ResolvedConfig

    // Since `resolveConfig` sets NODE_ENV for some reason,
    // we need to set it here to avoid SSR issues.
    process.env.NODE_ENV =
      config.mode == 'production' ? 'production' : undefined

    // @ts-ignore
    config.configFile = loadResult.path

    config.optimizeDeps.entries = [
      ...arrify(config.optimizeDeps.entries),
      // Skip "saus/client" in build mode, so we don't get warnings
      // from trying to resolve imports for modules included in the
      // bundled Saus runtime (see "../bundle/runtimeBundle.ts").
      ...arrify(inServeMode ? toSausPath('client/index.js') : undefined),
    ]

    return config
  }

  const config = await resolveConfig()
  const context = await createContext({
    config,
    command,
    publicDir,
    resolveConfig,
  })

  setResponseCache(loadResponseCache(userConfig.root!))
  return context as T
}
