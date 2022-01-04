export { render } from './render'
export { route } from './routes'
export { beforeRender, Plugin, UserConfig, vite } from './core'

export { htmlEscape as escape } from 'escape-goat'

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

import { vite, UserConfig } from './core'

type Promisable<T> = T | Promise<T>

// Ensure the "saus" property is required.
export const defineConfig = vite.defineConfig as (
  config:
    | Promisable<UserConfig>
    | ((env: vite.ConfigEnv) => Promisable<UserConfig>)
) => vite.UserConfigExport
