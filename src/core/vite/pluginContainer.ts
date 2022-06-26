import { Plugin, vite } from '../vite'

export interface PluginContainer extends vite.PluginContainer {
  plugins: readonly Plugin[]
}

export async function createPluginContainer(config: vite.ResolvedConfig) {
  const container = (await vite.createPluginContainer(
    config
  )) as PluginContainer
  container.plugins = config.plugins
  return container
}
