import { CacheControl, StateOptions, withCache } from '../core/withCache'
import { globalCache } from './cache'

type Promisable<T> = T | PromiseLike<T>

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
