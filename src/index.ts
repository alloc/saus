import { UserConfig, vite } from './core'

export * from './api'
export * from './plugins/publicDir'
export { Plugin, UserConfig, vite } from './core'

export {
  addDeployTarget,
  getDeployContext,
  DeployContext,
  DeployHook,
  DeployPlugin,
  DeployTarget,
} from './core/deploy'

type BuildFactory = typeof import('./build').build
type ServerFactory = typeof import('./dev').createServer

export const build: BuildFactory = async inlineConfig => {
  const { build } = await import('./build')
  return build(inlineConfig)
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
