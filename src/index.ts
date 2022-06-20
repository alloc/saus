import { UserConfig, vite } from './core'

export * from './api'
export { onDeploy, Plugin, UserConfig, vite } from './core'
export * from './plugins/publicDir'

type BuildFactory = typeof import('./build').build
type BundleFactory = typeof import('./bundle').bundle
type ServerFactory = typeof import('./dev').createServer

export const build: BuildFactory = async inlineConfig => {
  const { build } = await import('./build')
  return build(inlineConfig)
}

export const generateBundle: BundleFactory = async (config, options) => {
  const { bundle } = await import('./bundle')
  return bundle(config, options)
}

export const createServer: ServerFactory = async inlineConfig => {
  const { createServer } = await import('./dev')
  return createServer(inlineConfig)
}

type Promisable<T> = T | Promise<T>

// Ensure the "saus" property is required.
export const defineConfig = vite.defineConfig as (
  config: UserConfig | ((env: vite.ConfigEnv) => Promisable<UserConfig>)
) => vite.UserConfigExport
