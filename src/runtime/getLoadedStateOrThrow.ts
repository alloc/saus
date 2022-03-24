import { globalCache } from './cache'

export function getLoadedStateOrThrow(cacheKey: string, args: any[]) {
  const cached = globalCache.loaded[cacheKey]
  if (!cached) {
    const error = Error(
      `Failed to access "${cacheKey}" state. ` +
        `This fragment is not included by the route config.`
    )
    throw Object.assign(error, { args })
  }
  return cached
}
