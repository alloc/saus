import type { Promisable } from 'type-fest'
import type { Cache, CacheControl } from './cache'

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
  get?: (name: string) => Promisable<Cache.Entry | undefined>
  /**
   * Upsert a cache entry with freshly loaded state.
   */
  put?: (name: string, state: any, expiresAt?: number) => Promisable<void>
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
  get loader() {
    if (cachePlugin?.get) {
      return loader
    }
  },
}

const loader = async (name: string, cacheControl: CacheControl) => {
  const entry = await cachePlugin!.get!(name)
  if (entry) {
    if (entry[1]) {
      cacheControl.maxAge = (entry[1] - Date.now()) / 1e3
    }
    return entry[0]
  }
}
