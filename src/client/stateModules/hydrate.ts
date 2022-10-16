import { Cache, globalCache } from '@runtime/cache'
import type { StateModule } from '@runtime/stateModules'

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
  const hydratedState = hydrate ? hydrate(served.state, served) : null!
  const hydrated = hydrate ? { ...served, state: hydratedState } : served
  globalCache.loaded[key] = hydrated
  globalCache.listeners[module.name]?.forEach(callback =>
    callback(hydratedState, hydrated)
  )
  return hydratedState
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
