import type { App, ProfiledEventHandler } from '../app/types'
import { Falsy, OneOrMany } from '../utils/types'

export interface RuntimeConfig {
  assetsDir: string
  base: string
  bundleType?: 'script' | 'worker'
  command: 'dev' | 'bundle'
  debugBase?: string
  defaultLayoutId: string
  defaultPath: string
  delayModulePreload?: boolean
  githubRepo?: string
  githubToken?: string
  helpersModuleId: string
  htmlTimeout?: number
  minify: boolean
  mode: string
  publicDir: string
  renderConcurrency?: number
  ssrRoutesId: string
  stateCacheId: string
  stateModuleBase: string
  stripLinkTags?: boolean
}

// These properties are baked into the client modules, and so they
// cannot be updated at runtime.
type RuntimeConstants =
  | 'base'
  | 'command'
  | 'debugBase'
  | 'defaultPath'
  | 'mode'
  | 'ssrRoutesId'
  | 'stateCacheId'

export interface MutableRuntimeConfig
  extends Omit<RuntimeConfig, RuntimeConstants> {
  profile?: ProfiledEventHandler
}

export type RuntimeHook = (
  config: RuntimeConfig
) => OneOrMany<App.Plugin | Falsy> | void
