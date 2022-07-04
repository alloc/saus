import arrify from 'arrify'
import { resolve } from 'path'
import type { BuildContext, BundleContext } from '../bundle'
import type { DeployContext } from '../deploy'
import type { DevContext, DevMethods, DevState } from '../dev/context'
import type { RenderPageResult } from './app/types'
import { ConfigHook, ConfigHookRef } from './configHooks'
import { debug } from './debug'
import { HtmlContext } from './html'
import { loadResponseCache, setResponseCache } from './http/responseCache'
import { CompileCache } from './node/compileCache'
import { relativeToCwd } from './node/relativeToCwd'
import { toSausPath } from './paths'
import { PublicDirOptions } from './publicDir'
import { RouteClients } from './routeClients'
import { RoutesModule } from './routes'
import { clearCachedState } from './runtime/clearCachedState'
import { getCachedState } from './runtime/getCachedState'
import { Cache, withCache } from './runtime/withCache'
import {
  Plugin,
  ResolvedConfig,
  SausConfig,
  SausPlugin,
  UserConfig,
  vite,
} from './vite'
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
  configHooks?: ConfigHookRef[]
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
  resolveConfig: (
    command: SausCommand,
    configHooks?: ConfigHookRef[],
    inlineConfig?: vite.UserConfig
  ) => Promise<ResolvedConfig>
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

function createContext(
  command: SausCommand,
  config: ResolvedConfig,
  resolveConfig: Context['resolveConfig']
): Context {
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
    basePath: config.base,
    clearCachedPages: filter => clearCachedState(filter, pageCache),
    command,
    compileCache: new CompileCache('node_modules/.saus', config.root),
    config,
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
    publicDir: null,
    require: null!,
    resolveConfig,
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
  inlineConfig?: vite.InlineConfig,
  inlinePlugins?: InlinePlugin[]
): Promise<T> {
  let context!: Context

  const resolveConfig = getConfigResolver(
    inlineConfig || {},
    inlinePlugins,
    config => (context ||= createContext(command, config, resolveConfig))
  )

  // The `context.config` always assumes the build command,
  // so we can load the routes before the dev server is ready.
  // Otherwise, plugins like `vite:importAnalysis` will assume
  // the `configureServer` hook was called while loading routes.
  await resolveConfig('build')

  setResponseCache(loadResponseCache(context!.root))
  return context as T
}

function getConfigResolver(
  defaultConfig: vite.InlineConfig,
  inlinePlugins: InlinePlugin[] | undefined,
  getContext: (config: ResolvedConfig) => Context
) {
  return async (
    command: SausCommand,
    configHooks: ConfigHookRef[] = [],
    inlineConfig?: vite.InlineConfig
  ) => {
    const isDevServer = command == 'serve'
    const sausDefaults: vite.InlineConfig = {
      configFile: false,
      server: {
        preTransformRequests: isDevServer,
        fs: {
          allow: [toSausPath('')],
        },
      },
      ssr: {
        noExternal: isDevServer ? ['saus/client'] : true,
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

    const defaultMode = isDevServer ? 'development' : 'production'
    const viteCommand = isDevServer ? command : 'build'
    const configEnv: vite.ConfigEnv = {
      command: viteCommand,
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
    assertSausConfig(sausConfig, 'routes')
    sausConfig.routes = resolve(root, sausConfig.routes)
    sausConfig.defaultPath ||= '/404'
    sausConfig.stateModuleBase ||= '/state/'
    sausConfig.defaultLayoutId ||= '/src/layouts/default'

    const publicDir: PublicDirOptions | null =
      typeof userConfig.publicDir == 'object' ||
      typeof userConfig.publicDir == 'boolean'
        ? userConfig.publicDir || null
        : { root: userConfig.publicDir }

    // Vite expects a string, false, or undefined.
    userConfig.publicDir = publicDir ? publicDir.root : false

    if (inlinePlugins) {
      userConfig.plugins ??= []
      userConfig.plugins.unshift(
        ...inlinePlugins.map(create => create(sausConfig, configEnv))
      )
    }

    for (const hookRef of configHooks) {
      const hookModule = require(hookRef.path)
      const configHook: ConfigHook = hookModule.__esModule
        ? hookModule.default
        : hookModule

      if (typeof configHook !== 'function')
        throw Error(
          `[saus] Config hook must export a function: ${hookRef.path}`
        )

      const result = await configHook(userConfig as UserConfig, configEnv)
      if (result) {
        userConfig = vite.mergeConfig(userConfig, result)
      }
      if (process.env.DEBUG) {
        debug(`Applied config hook: %O`, relativeToCwd(hookRef.path))
      }
    }

    const config = (await vite.resolveConfig(
      userConfig,
      viteCommand,
      defaultMode
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
      ...arrify(isDevServer ? toSausPath('client/index.js') : undefined),
    ]

    const context = getContext(config)
    context.publicDir = publicDir
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
