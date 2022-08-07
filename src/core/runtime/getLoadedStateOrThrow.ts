import { Cache, globalCache } from './cache'

export function getLoadedStateOrThrow(
  cacheKey: string,
  args: readonly any[]
): Cache.Entry {
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
