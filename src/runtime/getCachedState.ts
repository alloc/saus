import { withCache } from '../core/withCache'
import * as globalCache from './cache'

/** Load state if missing from the global cache */
export const getCachedState = withCache(globalCache) as {
  <State = any>(cacheKey: string): Promise<State | undefined>
  <State = any>(cacheKey: string, loader: () => Promise<State>): Promise<State>
}
