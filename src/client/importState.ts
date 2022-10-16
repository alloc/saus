import { globalCache, preHydrateCache } from '@runtime/cache'
import { preCacheState } from './preCacheState'

/**
 * Wait for these state modules to be hydrated.
 */
export async function importState(...cacheKeys: string[]) {
  await preCacheState(...cacheKeys)
  return Promise.all(
    cacheKeys.map(async cacheKey => {
      if (preHydrateCache.has(cacheKey)) {
        await new Promise(resolve => {
          const name = cacheKey.replace(/(\.\d+)?$/, '')
          globalCache.listeners[name] ||= new Set()
          globalCache.listeners[name].add(resolve)
        })
      }
      return globalCache.loaded[cacheKey]
    })
  )
}
