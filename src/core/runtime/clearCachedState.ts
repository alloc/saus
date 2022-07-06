import createDebug from 'debug'
import { globalCache } from './cache'
import type { Cache } from './withCache'

const debug = createDebug('saus:cache')

/**
 * Traverse the given cache, removing any keys that match.
 */
export function clearCachedState(
  filter: string | ((key: string) => boolean) = () => true,
  cache: Cache = globalCache
) {
  const stores = Object.values(cache)
  if (typeof filter == 'function') {
    let found: string[] = []
    for (const store of stores) {
      for (const key in store) {
        if (filter(key) && delete store[key]) {
          found.push(key)
        }
      }
    }
    for (const key of found) {
      debug('clearCachedState(%O)', key)
    }
  } else {
    let found = false
    for (const store of stores) {
      if (delete store[filter]) {
        found = true
      }
    }
    if (found) {
      debug('clearCachedState(%O)', filter)
    }
  }
}
