import { debug } from './debug'

export type Cache<State = any> = {
  loading: Record<string, Promise<CacheEntry<State>>>
  loaded: Record<string, CacheEntry<State>>
}

/** The internal data structure used by `Cache` type */
export type CacheEntry<State = any> = [state: State, expiresAt?: number]

export type CacheControl = {
  /** The string used to identify this entry */
  readonly key: string
  /**
   * Number of seconds until this entry is reloaded on next request.
   * Note that loaderless requests may be given expired data.
   */
  maxAge: number
}

type StateLoader<State = any> = {
  (cacheControl: CacheControl): Promise<State>
}

export function withCache<State = any>(
  cache: Cache,
  getDefaultLoader: (cacheKey: string) => StateLoader<State>
): (cacheKey: string, loader?: StateLoader<State>) => Promise<State>

export function withCache<State = any>(
  cache: Cache,
  getDefaultLoader?: (cacheKey: string) => StateLoader<State> | undefined
): {
  (cacheKey: string): Promise<State | undefined>
  (cacheKey: string, loader: StateLoader<State>): Promise<State>
}

export function withCache(
  cache: Cache,
  getDefaultLoader: (cacheKey: string) => StateLoader | undefined = () =>
    undefined
) {
  return function getCachedState(cacheKey: string, loader?: StateLoader) {
    const entry = cache.loaded[cacheKey]
    if (entry) {
      const expiresAt = entry[1] ?? Infinity
      const useCachedValue =
        expiresAt - Date.now() > 0 ||
        // Use expired state if no loader is given.
        !(loader ||= getDefaultLoader(cacheKey))

      if (useCachedValue) {
        return Promise.resolve(entry[0])
      }
    }

    let entryPromise = cache.loading[cacheKey] as
      | Promise<CacheEntry>
      | undefined

    if (entryPromise || !(loader ||= getDefaultLoader(cacheKey))) {
      return entryPromise
    }

    const entryConfig: CacheControl = {
      key: cacheKey,
      maxAge: Infinity,
    }

    entryPromise = cache.loading[cacheKey] = loader(entryConfig)
    return entryPromise.then(
      state => {
        // Skip caching if the promise is replaced or deleted
        // before it resolves.
        if (entryPromise == cache.loading[cacheKey]) {
          const { maxAge } = entryConfig
          if (maxAge > 0) {
            cache.loaded[cacheKey] = isFinite(maxAge)
              ? [state, Date.now() + maxAge * 1e3]
              : [state]
          } else {
            debug('State %s expired while loading, skipping cache', cacheKey)
          }
          delete cache.loading[cacheKey]
        }
        return state
      },
      error => {
        if (entryPromise == cache.loading[cacheKey]) {
          delete cache.loading[cacheKey]
        }
        throw error
      }
    )
  }
}
