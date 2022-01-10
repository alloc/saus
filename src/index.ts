import { vite, UserConfig } from './core'

export * from './api'
export * from './plugins/publicDir'
export { Plugin, UserConfig, vite } from './core'

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
  config:
    | Promisable<UserConfig>
    | ((env: vite.ConfigEnv) => Promisable<UserConfig>)
) => vite.UserConfigExport
