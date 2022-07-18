import { toArray } from '@/utils/array'
import { green } from 'kleur/colors'
import { join } from 'path'
import { plural } from '../api'
import { SausCommand } from '../context'
import { findConfigFiles } from '../findConfigFiles'
import { relativeToCwd } from '../node/relativeToCwd'
import { vite } from '../vite'
import { loadConfigFile } from './configFile'

/**
 * Dependencies in `node_modules` can set a `vite.config.js` file
 * to be loaded automatically by Saus.
 */
export async function loadConfigDeps(
  command: SausCommand,
  config: {
    root: string
    plugins?: (vite.PluginOption | vite.PluginOption[])[]
  },
  logger?: vite.Logger
): Promise<vite.UserConfig> {
  const configFiles = findConfigFiles(config.root)
  logger?.warnOnce(
    green('✔︎ ') +
      `Loaded ${plural(
        configFiles.length,
        'vite.config.js file'
      )} from ${relativeToCwd(join(config.root, 'node_modules'))}`
  )

  const userPlugins = toArray(config.plugins)
    .flat()
    .filter(Boolean) as vite.Plugin[]

  const userPluginIds = userPlugins.map(p => p.name)

  let configDeps: vite.UserConfig | undefined
  for (const configFile of configFiles) {
    const loadResult = await loadConfigFile(command, configFile)
    if (loadResult) {
      const { plugins, ...config } = loadResult.config
      configDeps = configDeps ? vite.mergeConfig(configDeps, config) : config

      // Ensure auto-loaded config never injects a plugin that's been
      // manually configured by the user.
      for (const plugin of toArray(plugins).flat()) {
        if (plugin && !userPluginIds.includes(plugin.name)) {
          userPluginIds.push(plugin.name)
          userPlugins.push(plugin)
        }
      }
    }
  }

  return { ...configDeps, plugins: userPlugins }
}
