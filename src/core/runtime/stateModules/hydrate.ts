import { Cache, globalCache } from '../cache'
import type { StateModule } from '../stateModules'

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
