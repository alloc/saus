import type { Cache } from './cache'
import { createCache } from './cache/create'
import { getStateModuleKey } from './getStateModuleKey'

/**
 * All state in the global cache is meant to be used when rendering.
 * This means the state has been processed by `onLoad` listeners.
 */
export const globalCache = createCache()

export function setState<Args extends readonly any[]>(
  name: string,
  args: Args,
  state: any,
  expiresAt?: Cache.EntryExpiration
): any {
  const key = getStateModuleKey(name, args)
  globalCache.loaded[key] = [state, expiresAt, args]
  globalCache.listeners[name]?.forEach(callback =>
    callback(args, state, expiresAt)
  )
  return state
}

export type { CacheControl } from './cache/cacheControl'
export type { Cache } from './cache/types'
export { createCache }
