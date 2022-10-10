import type { Cache } from './cache'
import { createCache } from './cache/create'
import { getStateModuleKey } from './getStateModuleKey'
import { notifyStateListeners } from './stateModules/events'

export const globalCache = createCache()

export function setState<Args extends readonly any[]>(
  moduleId: string,
  args: Args,
  state: any,
  expiresAt?: Cache.EntryExpiration
): any {
  const cacheKey = getStateModuleKey(moduleId, args)
  globalCache.loaded[cacheKey] = [state, expiresAt, args]
  notifyStateListeners(moduleId, args, state, expiresAt)
  return state
}

export type { CacheControl } from './cache/cacheControl'
export type { Cache } from './cache/types'
export { createCache }
