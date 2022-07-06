import { resolve } from 'path'
import type { SausCommand } from '../context'
import { findConfigFiles } from '../findConfigFiles'
import { toSausPath } from '../paths'
import { toArray } from '../utils/array'
import { BundleConfig, SausConfig, UserConfig, vite } from '../vite'

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

export const loadConfigFile = (
  command: SausCommand,
  configFile?: string,
  inlineConfig: vite.InlineConfig = {}
) =>
  vite.loadConfigFromFile(
    getConfigEnv(command, inlineConfig.mode),
    configFile,
    inlineConfig.root,
    inlineConfig.logLevel
  )

export async function loadUserConfig(
  command: SausCommand,
  { plugins: inlinePlugins, ...inlineConfig }: vite.InlineConfig = {}
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
  sausConfig.stateModuleBase ||= '/state/'
  sausConfig.defaultLayoutId ||= '/src/layouts/default'

  const userPlugins = toArray(config.plugins).flat()
  const userPluginIds = userPlugins
    .map(p => p && p.name)
    .filter(Boolean) as string[]

  const isNewPlugin = (p: vite.PluginOption) =>
    p && !userPluginIds.includes(p.name)

  let autoConfig: vite.UserConfig | undefined
  for (const configFile of findConfigFiles(config.root!)) {
    const loadResult = await loadConfigFile(command, configFile)
    if (loadResult) {
      const { plugins, ...config } = loadResult.config
      autoConfig = autoConfig ? vite.mergeConfig(autoConfig, config) : config

      // Ensure auto-loaded config never injects a plugin that's been
      // manually configured by the user.
      for (const plugin of toArray(plugins).flat()) {
        if (isNewPlugin(plugin)) {
          userPlugins.push(plugin)
        }
      }
    }
  }

  config.plugins = userPlugins
  if (autoConfig) {
    config = vite.mergeConfig(config, autoConfig) as any
  }

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
