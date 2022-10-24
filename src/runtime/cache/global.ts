import type { StateModule } from '../stateModules'
import { createCache } from './create'

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
