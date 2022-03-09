import { SausContext } from './context'
import { Plugin, SausPlugin, vite } from './vite'

export async function getSausPlugins(
  context: SausContext,
  config = context.config
) {
  const sausPlugins: SausPlugin[] = []
  for (const p of flattenPlugins(config.plugins as Plugin[], p => {
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
  })) {
    const sausPlugin =
      typeof p.saus == 'function' ? await p.saus(context) : p.saus!

    if (sausPlugin) {
      sausPlugin.name ||= p.name
      sausPlugins.push(sausPlugin)
    }
  }
  return sausPlugins
}

function flattenPlugins<T extends vite.Plugin>(
  plugins: readonly T[],
  filter?: (p: T) => any
) {
  const filtered: vite.Plugin[] = filter ? plugins.filter(filter) : [...plugins]
  return vite.sortVitePlugins(filtered).flat() as T[]
}
