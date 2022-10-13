import { createCache } from './cache/create'
import type { StateModule } from './stateModules'

/**
 * All state in the global cache is meant to be used when rendering.
 * This means the state has been processed by `onLoad` listeners.
 */
export const globalCache = createCache()

/**
 * State modules are stored here for data hydration and hot reloading
 * support.
 */
export const stateModulesByName = new Map<string, StateModule>()

export type { Cache } from './cache/types'
export { setState } from './stateModules/setState'
export { createCache }
