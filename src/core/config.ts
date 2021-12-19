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
 * Access and manipulate the Vite config before it's applied.
 *
 * For compatibility with SSR bundling, anyone calling this should first
 * pass a module path along with their own `import.meta.url` string, so
 * their Vite plugins are excluded from the SSR bundle.
 */
export function addConfigHook(hookPath: string, importer = callerPath()) {
  assert(importer, 'Failed to infer where `addConfigHook` was called from')
  assert(configHooks, 'Cannot call `addConfigHook` at this time')

  hookPath = path.resolve(importer, hookPath)
  configHooks.push(hookPath)
}

export function setConfigHooks(hooks: string[] | null) {
  configHooks = hooks
}
