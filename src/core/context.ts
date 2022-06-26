import { ViteFunctions } from '@/vite/functions'
import arrify from 'arrify'
import { resolve } from 'path'
import type { DevContext } from '../dev/context'
import type { RenderPageResult } from './app/types'
import { ConfigHook, ConfigHookRef } from './configHooks'
import { debug } from './debug'
import { getSausPlugins } from './getSausPlugins'
import { HtmlContext } from './html'
import { loadResponseCache, setResponseCache } from './http/responseCache'
import { loadConfigHooks } from './loadConfigHooks'
import { CompileCache } from './node/compileCache'
import { relativeToCwd } from './node/relativeToCwd'
import { toSausPath } from './paths'
import { PublicDirOptions } from './publicDir'
import { RenderModule } from './render'
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
import { PluginContainer } from './vite/pluginContainer'

type Command = 'build' | 'deploy' | 'serve'

/**
 * This context exists in both serve and build mode.
 */
export interface BaseContext extends RenderModule, RoutesModule, HtmlContext {
  command: Command
  root: string
  plugins: readonly SausPlugin[]
  logger: vite.Logger
  config: ResolvedConfig
  configPath: string | undefined
  configHooks: ConfigHookRef[]
  userConfig: vite.UserConfig
  pluginContainer: PluginContainer
  publicDir: PublicDirOptions | null
  /**
   * Use this instead of `this.config` when an extra Vite build is needed,
   * or else you risk corrupting the Vite plugin state.
   */
  resolveConfig: (
    command: Command,
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
  /** Visit every cached page. Loading pages are waited for. */
  forCachedPages: (
    onPage: (pagePath: string, pageResult: RenderPageResult) => void
  ) => Promise<void>
  /** Clear any matching pages (loading or loaded) */
  clearCachedPages: (filter?: string | ((key: string) => boolean)) => void
  /** Path to the render module */
  renderPath: string
}

type ProdContext = BaseContext &
  Partial<Omit<DevContext, keyof BaseContext>> & {
    command: 'build'
  }

export type SausContext = (DevContext | ProdContext) & ViteFunctions
export type { DevContext, ProdContext }

type InlinePlugin = (
  sausConfig: SausConfig,
  configEnv: vite.ConfigEnv
) => Plugin | Plugin[]

function createContext(
  config: ResolvedConfig,
  configHooks: ConfigHookRef[],
  resolveConfig: BaseContext['resolveConfig']
): BaseContext {
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
    command: config.command,
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
    forCachedPages,
    clearCachedPages: filter => clearCachedState(filter, pageCache),
    renderPath: config.saus.render,
    renderers: [],
    beforeRenderHooks: [],
  }
}

export async function loadContext<T extends BaseContext>(
  command: Command,
  inlineConfig?: vite.InlineConfig,
  inlinePlugins?: InlinePlugin[]
): Promise<T> {
  let context: BaseContext | undefined
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
  return context as T
}

function getConfigResolver(
  defaultConfig: vite.InlineConfig,
  inlinePlugins: InlinePlugin[] | undefined,
  getConfigHooks: (config: ResolvedConfig) => Promise<ConfigHookRef[]>,
  getContext: (config: ResolvedConfig) => BaseContext
) {
  return async (command: Command, inlineConfig?: vite.InlineConfig) => {
    const isBuild = command !== 'serve'
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
    const viteCommand = isBuild ? 'build' : command
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
    assertSausConfig(sausConfig, 'render')
    assertSausConfig(sausConfig, 'routes')
    sausConfig.render = resolve(root, sausConfig.render)
    sausConfig.routes = resolve(root, sausConfig.routes)
    sausConfig.defaultPath ||= '/404'
    sausConfig.stateModuleBase ||= '/state/'

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

    // @ts-ignore
    config.configFile = loadResult.path

    // The render module and "saus/client" need their deps optimized.
    config.optimizeDeps.entries = [
      sausConfig.render,
      ...arrify(config.optimizeDeps.entries),
      // Skip "saus/client" in build mode, so we don't get warnings
      // from trying to resolve imports for modules included in the
      // bundled Saus runtime (see "../bundle/runtimeBundle.ts").
      ...arrify(isBuild ? undefined : toSausPath('client/index.js')),
    ]

    const context = getContext(config)
    context.publicDir = publicDir
    if (command == 'build') {
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
