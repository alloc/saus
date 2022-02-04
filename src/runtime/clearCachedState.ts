import createDebug from 'debug'
import * as globalCache from './cache'

const debug = createDebug('saus:cache')

/**
 * Traverse the `loadingStateCache` and `loadedStateCache` maps,
 * removing any keys that match.
 */
export function clearCachedState(
  filter: string | ((key: string) => boolean) = () => true,
  { loadingStateCache, loadedStateCache } = globalCache
) {
  if (typeof filter == 'function') {
    const clear = (_: any, key: string, cache: Map<string, any>) =>
      filter(key) && cache.delete(key) && debug('clearCachedState(%O)', key)

    loadingStateCache.forEach(clear)
    loadedStateCache.forEach(clear)
  } else {
    const wasLoaded = loadedStateCache.delete(filter),
      wasLoading = loadingStateCache.delete(filter)

    if (wasLoaded || wasLoading) {
      debug('clearCachedState(%O)', filter)
    }
  }
}
