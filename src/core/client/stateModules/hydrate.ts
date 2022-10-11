import { Cache, globalCache } from '@/runtime/cache'
import type { StateModule } from '@/runtime/stateModules'

/**
 * Hydrate the data served for a state module, and inject it into the
 * global cache.
 */
export function hydrateState(
  key: string,
  served: Cache.Entry,
  module: StateModule
) {
  const [state, expiresAt, args] = served
  const hydrate = module['_hydrate']
  const hydratedState = hydrate ? hydrate(args, state, expiresAt) : state
  globalCache.loaded[key] = [hydratedState, expiresAt, args]
  globalCache.listeners[module.name]?.forEach(callback =>
    callback(args, hydratedState, expiresAt)
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
      const [state, expiresAt, args] = globalCache.loaded[key]
      listener(args, state, expiresAt)
    }
  }
}
