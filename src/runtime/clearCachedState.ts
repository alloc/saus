import createDebug from 'debug'
import { globalCache } from './cache'

const debug = createDebug('saus:cache')

/**
 * Traverse the given cache, removing any keys that match.
 */
export function clearCachedState(
  filter: string | ((key: string) => boolean) = () => true,
  cache = globalCache
) {
  if (typeof filter == 'function') {
    const clear = (cache: Record<string, any>) => {
      for (const key in cache) {
        if (filter(key)) {
          debug('clearCachedState(%O)', key)
          delete cache[key]
        }
      }
    }
    clear(cache.loading)
    clear(cache.loaded)
  } else {
    if (filter in cache.loaded || filter in cache.loading) {
      debug('clearCachedState(%O)', filter)
    }
    delete cache.loading[filter]
    delete cache.loaded[filter]
  }
}
