import { CacheControl, withCache } from '../core/withCache'
import { globalCache } from './cache'

type Promisable<T> = T | PromiseLike<T>

/** Load state if missing from the global cache */
export const getCachedState = withCache(globalCache) as {
  <State = any>(cacheKey: string): Promise<State | undefined> | undefined
  <State = any>(
    cacheKey: string,
    loader: (cacheControl: CacheControl) => Promisable<State>
  ): Promise<State>
}
