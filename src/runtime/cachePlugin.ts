import type { Promisable } from 'type-fest'
import type { Cache } from './cache'

/**
 * The `CachePlugin` is a normalized data storage layer.
 *
 * Only "state modules" are cached with this.
 */
export interface CachePlugin {
  /**
   * Retrieve a cache entry by name.
   *
   * You should leave this undefined if you don't care about reloading
   * a possibly cached state module when used by an uncached page.
   */
  get?: (
    cacheKey: string,
    abortSignal: AbortSignal
  ) => Promisable<Cache.Entry<any> | undefined>
  /**
   * Upsert a cache entry with freshly loaded state.
   */
  put?: (cacheKey: string, entry: Cache.Entry<any>) => Promisable<void>
}

let cachePlugin: CachePlugin | undefined

/**
 * By default, state modules are stored in a LRU cache (in memory). \
 * Call this to extend that behavior. Multiple calls will override
 * the previous calls.
 *
 * Note that returning a `CacheEntry` with an undefined state is
 * the same as returning an undefined entry.
 */
export function injectCachePlugin(plugin: CachePlugin) {
  cachePlugin = plugin
}

export const CachePlugin = {
  get get() {
    return cachePlugin?.get
  },
  get put() {
    return cachePlugin?.put
  },
  pendingPuts: new Map<string, Promise<any>>(),
}
