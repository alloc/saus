import assert from 'assert'
import callerPath from 'caller-path'
import path from 'path'
import type { ConfigEnv, UserConfig } from 'vite'
import { renderModule } from './global'

export type ConfigHook = (
  config: UserConfig,
  env: ConfigEnv
) => UserConfig | Promise<UserConfig> | null

export type ConfigHookRef = {
  path: string
  source: string
}

/** Paths to modules that inject Vite config */
let configHooks: ConfigHookRef[] | null = null

/**
 * Register a module that exports Vite config, which will be merged
 * into the user's Vite config.
 */
export function addConfigHook(hookPath: string, source = callerPath()) {
  if (configHooks) {
    assert(source, 'Failed to infer where `addConfigHook` was called from')
    configHooks.push({
      path: path.resolve(path.dirname(source), hookPath),
      source,
    })
  } else if (!renderModule) {
    throw Error('Cannot call `addConfigHook` at this time')
  }
}

export function setConfigHooks(hooks: ConfigHookRef[] | null) {
  configHooks = hooks
}

export interface RuntimeConfig {
  assetsDir: string
  base: string
  bundleType?: 'script' | 'worker'
  command: 'dev' | 'bundle'
  debugBase?: string
  defaultPath: string
  minify: boolean
  mode: string
  publicDir: string
  renderConcurrency?: number
  stateCacheId: string
}
