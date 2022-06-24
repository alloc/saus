import { globalCache } from './cache'
import type { CacheEntry } from './withCache'

export function getLoadedStateOrThrow(
  cacheKey: string,
  args: any[]
): CacheEntry {
  const cached = globalCache.loaded[cacheKey]
  if (!cached) {
    const error = Error(
      `Failed to access "${cacheKey}" state module. ` +
        `Are you sure this route is configured to include it?`
    )
    throw Object.assign(error, {
      code: 'STATE_MODULE_404',
      cacheKey,
      args,
    })
  }
  return cached
}
