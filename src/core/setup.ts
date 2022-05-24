import type { App } from '../app/types'
import type { Falsy, OneOrMany } from '../utils/types'
import type { RuntimeConfig } from './config'
import { routesModule } from './global'

export type RuntimeHook = (
  config: RuntimeConfig
) => OneOrMany<App.Plugin | Falsy> | void

/**
 * Set up the runtime according to the given environment.
 *
 * Can only be called from your `saus.routes` module or from
 * a module imported by it (directly or transiently).
 */
export function setup(hook: RuntimeHook) {
  routesModule.runtimeHooks.push(hook)
}
