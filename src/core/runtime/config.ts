import { Falsy, OneOrMany } from '@utils/types'
import type { App, ProfiledEventHandler } from './app/types'

export interface RuntimeConfig {
  appVersion?: string
  assetsDir: string
  base: string
  bundleType?: 'script' | 'worker'
  clientCacheId: string
  clientHelpersId: string
  clientRuntimeId: string
  command: 'dev' | 'bundle'
  debugBase?: string
  defaultLayout: { id: string; hydrated?: boolean }
  defaultPath: string
  githubRepo?: string
  githubToken?: string
  htmlTimeout?: number
  minify: boolean
  mode: string
  publicDir: string
  renderConcurrency?: number
  ssrEntryId: string
  stateModuleBase: string
}

// These properties are baked into the client modules, and so they
// cannot be updated at runtime.
type RuntimeConstants =
  | 'base'
  | 'clientCacheId'
  | 'command'
  | 'debugBase'
  | 'defaultPath'
  | 'mode'
  | 'ssrRoutesId'

export interface MutableRuntimeConfig
  extends Omit<RuntimeConfig, RuntimeConstants> {
  profile?: ProfiledEventHandler
}

export type RuntimeHook = (
  config: RuntimeConfig
) => OneOrMany<App.Plugin | Falsy> | void
