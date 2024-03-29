import { globalCache } from '@runtime/cache/global'
import type { Cache } from '@runtime/cache/types'
import type { StateModule } from '@runtime/stateModules'

/**
 * Data from the server is stored here until a matching state module is
 * loaded by the client. This is only used in a client context.
 */
export const preHydrateCache = new Map<string, StateModule.CacheEntry>()

/**
 * Hydrate the data served for a state module, and inject it into the
 * global cache.
 */
export function hydrateState(
  key: string,
  served: StateModule.CacheEntry,
  module: StateModule
) {
  const hydrate = module['_hydrate']
  try {
    const hydratedState = hydrate ? hydrate(served.state, served) : null!
    const hydrated = hydrate ? { ...served, state: hydratedState } : served
    globalCache.loaded[key] = hydrated
    globalCache.listeners[module.name]?.forEach(callback =>
      callback(hydratedState, hydrated)
    )
    return hydratedState
  } catch (err: any) {
    err.message = `Error while hydrating state module "${key}": ${err.message}`
    throw err
  }
}

/**
 * Call a state listener for data that has already been hydrated.
 */
export function hydrateStateListener(id: string, listener: Cache.Listener) {
  const keyPattern = new RegExp(`^${id}(\\.\\d+)?$`)
  for (const key in globalCache.loaded) {
    if (keyPattern.test(key)) {
      const entry = globalCache.loaded[key]
      listener(entry.state, entry)
    }
  }
}
