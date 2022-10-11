import type { Cache } from './cache'
import { createCache } from './cache/create'
import { getStateModuleKey } from './getStateModuleKey'
import type { StateModule } from './stateModules'
import { hydrateState } from './stateModules/hydrate'

/**
 * All state in the global cache is meant to be used when rendering.
 * This means the state has been processed by `onLoad` listeners.
 */
export const globalCache = createCache()

/**
 * Data from the server is stored here until a matching state module is
 * loaded by the client. This is only used in a client context.
 */
export const preHydrateCache = new Map<string, Cache.Entry>()

/**
 * State modules are stored here for data hydration and hot reloading
 * support.
 */
export const stateModulesByName = new Map<string, StateModule>()

/**
 * State modules must call this when loaded by the client.
 */
export function setState<Args extends readonly any[]>(
  name: string,
  args: Args,
  state: any,
  expiresAt?: Cache.EntryExpiration
): any {
  const key = getStateModuleKey(name, args)
  const served: Cache.Entry = [state, expiresAt, args]
  const module = stateModulesByName.get(name)
  if (module) {
    hydrateState(key, served, module)
  } else {
    preHydrateCache.set(key, served)
  }
  return state
}

export type { CacheControl } from './cache/cacheControl'
export type { Cache } from './cache/types'
export { createCache }
