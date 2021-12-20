import path from 'path'
import assert from 'assert'
import callerPath from 'caller-path'
import { ConfigEnv, UserConfig } from 'vite'

export type ConfigHook =
  | UserConfig
  | Promise<UserConfig>
  | ((
      config: UserConfig,
      env: ConfigEnv
    ) => UserConfig | Promise<UserConfig> | null)

/** Paths to modules that inject Vite config */
let configHooks: string[] | null = null

/**
 * Register a module that exports Vite config, which will be merged
 * into the user's Vite config.
 */
export function addConfigHook(hookPath: string, importer = callerPath()) {
  assert(importer, 'Failed to infer where `addConfigHook` was called from')
  assert(configHooks, 'Cannot call `addConfigHook` at this time')

  hookPath = path.resolve(path.dirname(importer), hookPath)
  configHooks.push(hookPath)
}

export function setConfigHooks(hooks: string[] | null) {
  configHooks = hooks
}
