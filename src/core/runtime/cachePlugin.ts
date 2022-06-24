import type { CacheControl, CacheEntry } from './withCache'

/**
 * The `CachePlugin` is a normalized data storage layer.
 *
 * Only "state modules" are cached with this.
 */
export interface CachePlugin {
  get: (name: string) => Promise<CacheEntry | undefined>
  put?: (name: string, state: any, expiresAt?: number) => Promise<boolean>
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
export function useCachePlugin(plugin: CachePlugin) {
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
    if (cachePlugin) {
      return loader
    }
  },
}

const loader = async (name: string, cacheControl: CacheControl) => {
  const entry = await cachePlugin!.get(name)
  if (entry) {
    if (entry[1]) {
      cacheControl.maxAge = (entry[1] - Date.now()) / 1e3
    }
    return entry[0]
  }
}
