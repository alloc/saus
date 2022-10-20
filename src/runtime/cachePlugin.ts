import type { Promisable } from 'type-fest'
import type { Cache } from './cache'
import { serveCache } from './stateModules/serve'

/**
 * The `CachePlugin` is a normalized data storage layer.
 *
 * Only "state modules" are cached with this.
 */
export interface CachePlugin {
  /** Set by `injectCachePlugin` if undefined */
  pendingPuts?: Map<string, Promise<any>>
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

/**
 * By default, state modules are stored in a LRU cache (in memory). \
 * Call this to extend that behavior. Multiple calls will override
 * the previous calls.
 *
 * Note that returning a `CacheEntry` with an undefined state is
 * the same as returning an undefined entry.
 */
export function injectCachePlugin(plugin: CachePlugin) {
  serveCache.plugin = plugin
  plugin.pendingPuts ||= new Map()
}

export function waitForCachePlugin() {
  if (!serveCache.plugin) {
    return Promise.resolve()
  }
  const { pendingPuts } = serveCache.plugin
  return Promise.all(pendingPuts!.values())
}
