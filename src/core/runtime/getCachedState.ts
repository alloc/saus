import { globalCache } from './cache'
import { CacheControl, StateOptions, withCache } from './withCache'

type Promisable<T> = T | PromiseLike<T>

console.log('getCachedState(globalCache = %s)', globalCache.id)

/** Load state if missing from the global cache */
export const getCachedState = /* @__PURE__ */ withCache(globalCache) as {
  <State = any>(
    cacheKey: string,
    loader: (cacheControl: CacheControl) => Promisable<State>,
    options?: StateOptions
  ): Promise<State>
  <State = any>(
    cacheKey: string,
    loader?: (cacheControl: CacheControl) => Promisable<State>,
    options?: StateOptions
  ): Promise<State | undefined> | undefined
}
