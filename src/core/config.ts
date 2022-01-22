import assert from 'assert'
import callerPath from 'caller-path'
import path from 'path'
import type { ConfigEnv, UserConfig } from 'vite'
import { renderModule } from './global'

export type ConfigHook = (
  config: UserConfig,
  env: ConfigEnv
) => UserConfig | Promise<UserConfig> | null

/** Paths to modules that inject Vite config */
let configHooks: string[] | null = null

/**
 * Register a module that exports Vite config, which will be merged
 * into the user's Vite config.
 */
export function addConfigHook(hookPath: string, importer = callerPath()) {
  if (configHooks) {
    assert(importer, 'Failed to infer where `addConfigHook` was called from')
    hookPath = path.resolve(path.dirname(importer), hookPath)
    configHooks.push(hookPath)
  } else if (!renderModule) {
    throw Error('Cannot call `addConfigHook` at this time')
  }
}

export function setConfigHooks(hooks: string[] | null) {
  configHooks = hooks
}

export interface RuntimeConfig {
  assetsDir: string
  base: string
  bundleType?: 'script' | 'worker'
  command: 'dev' | 'bundle'
  defaultPath: string
  minify: boolean
  mode: string
  publicDir: string
  renderConcurrency?: number
  stateCacheUrl: string
}
