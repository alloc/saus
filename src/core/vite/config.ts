import { resolve } from 'path'
import type { SausCommand } from '../context'
import { toSausPath } from '../paths'
import { BundleConfig, SausConfig, UserConfig, vite } from '../vite'
import { loadConfigDeps } from './configDeps'
import { loadConfigFile } from './configFile'

export type LoadedUserConfig = UserConfig & {
  saus: SausConfig & { bundle: BundleConfig }
  configFile?: string
}

export function getConfigEnv(
  command: SausCommand,
  mode?: string
): vite.ConfigEnv {
  const inServeMode = command == 'serve'
  return {
    command: inServeMode ? command : 'build',
    mode: mode || (inServeMode ? 'development' : 'production'),
  }
}

export async function loadUserConfig(
  command: SausCommand,
  { plugins: inlinePlugins, ...inlineConfig }: vite.InlineConfig = {},
  logger?: vite.Logger
): Promise<LoadedUserConfig> {
  const inServeMode = command == 'serve'
  const sausDefaults: vite.InlineConfig = {
    configFile: false,
    server: {
      preTransformRequests: inServeMode,
      fs: {
        allow: [toSausPath('')],
      },
    },
    ssr: {
      noExternal: inServeMode ? ['saus/client'] : true,
    },
    build: {
      ssr: true,
    },
    optimizeDeps: {
      exclude: ['saus'],
    },
  }

  inlineConfig = vite.mergeConfig(sausDefaults, inlineConfig || {})

  const root = (inlineConfig.root = vite
    .normalizePath(resolve(inlineConfig.root || './'))
    .replace(/\/$/, ''))

  const loadResult = await loadConfigFile(command, undefined, inlineConfig)

  let config = inlineConfig as vite.UserConfig & { configFile?: string }
  if (loadResult) {
    config = vite.mergeConfig(loadResult.config, inlineConfig)
    config.configFile = loadResult.path
  }

  // Prepend any plugins from `inlineConfig`
  if (inlinePlugins) {
    config.plugins = config.plugins
      ? [...inlinePlugins, ...config.plugins]
      : inlinePlugins
  }

  const sausConfig = config.saus
  assertSausConfig(sausConfig)
  assertSausConfig(sausConfig, 'routes')
  sausConfig.routes = resolve(root, sausConfig.routes)
  sausConfig.defaultPath ||= '/404'
  sausConfig.stateModuleBase ||= '/.saus/state/'
  sausConfig.defaultLayoutId ||= '/src/layouts/default'

  const { plugins, ...configDeps } = await loadConfigDeps(
    command,
    { root, plugins: config.plugins },
    logger
  )
  if (Object.keys(configDeps).length) {
    config = vite.mergeConfig(config, configDeps) as any
  }

  config.plugins = plugins
  return config as LoadedUserConfig
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
