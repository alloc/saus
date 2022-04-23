import { klona } from 'klona'
import { AbortController, AbortSignal } from 'node-abort-controller'
import { debug } from './debug'

export type Cache<State = any> = {
  loading: Record<string, Promise<State>>
  loaders: Record<string, StateLoader<State>>
  loaded: Record<string, CacheEntry<State>>
}

/** The internal data structure used by `Cache` type */
export type CacheEntry<State = any> = [state: State, expiresAt?: number]

export type CacheControl = {
  /** The string used to identify this entry */
  readonly key: string
  /**
   * The last loaded value that is now expired.
   */
  oldValue?: any
  /**
   * Number of seconds until this entry is reloaded on next request.
   * Once expired, the loaded value remains in the cache until another
   * value is loaded.
   */
  maxAge: number
  /**
   * Set a timeout that aborts the loading of this entry unless its
   * promise resolves first.
   */
  setTimeout: (secs: number) => AbortSignal
}

type Promisable<T> = T | PromiseLike<T>
type StateLoader<State = any> = {
  (cacheControl: CacheControl): Promisable<State>
}

export interface StateOptions {
  /**
   * When this state is accessed in a SSR environment,
   * it will be deep-copied so it can be mutated in preparation
   * for page rendering without mutating the serialized data
   * that goes in the client module.
   */
  deepCopy?: boolean
}

export function withCache<State = any>(
  cache: Cache<State>,
  getDefaultLoader: (cacheKey: string) => StateLoader<State>
): (cacheKey: string, loader?: StateLoader<State>) => Promise<State>

export function withCache<State = any>(
  cache: Cache<State>,
  getDefaultLoader?: (cacheKey: string) => StateLoader<State> | undefined
): {
  (cacheKey: string): Promise<State | undefined> | undefined
  (cacheKey: string, loader: StateLoader<State>): Promise<State>
}

export function withCache(
  cache: Cache,
  getDefaultLoader: (cacheKey: string) => StateLoader | undefined = () =>
    undefined
) {
  return function getCachedState(
    cacheKey: string,
    loader?: StateLoader,
    options?: StateOptions
  ) {
    const entry = cache.loaded[cacheKey]
    if (entry) {
      const expiresAt = entry[1] ?? Infinity
      if (expiresAt - Date.now() > 0) {
        return deepCopy(Promise.resolve(entry[0]), options?.deepCopy)
      }
    }

    const oldPromise = cache.loading[cacheKey] as Promise<any> | undefined
    if (!oldPromise && !loader) {
      loader = getDefaultLoader(cacheKey)
    }
    if (oldPromise || !loader) {
      return oldPromise && deepCopy(oldPromise, options?.deepCopy)
    }

    let entryConfig!: CacheControl
    let loadResult: any
    let onLoad!: Function
    let onError: Function

    const promise = new Promise((resolve, reject) => {
      entryConfig = {
        key: cacheKey,
        oldValue: entry?.[0],
        maxAge: Infinity,
        setTimeout: secs => {
          const ctrl = new AbortController()
          setTimeout(() => {
            if (promise == cache.loading[cacheKey]) {
              delete cache.loading[cacheKey]
            }
            ctrl.abort()
            reject(new Error('Timed out'))
          }, secs * 1e3)

          return ctrl.signal
        },
      }
      loadResult = loader!(entryConfig)
      onLoad = resolve
      onError = reject
    })

    // If the loader is synchronous and threw an error,
    // the `onLoad` variable won't be defined.
    if (!onLoad) {
      return promise
    }

    // Avoid updating the cache if an old value is returned.
    if (loadResult === entryConfig.oldValue) {
      onLoad(options?.deepCopy ? klona(loadResult) : loadResult)
      return promise
    }

    cache.loaders[cacheKey] = loader
    cache.loading[cacheKey] = promise

    Promise.resolve(loadResult).then(
      state => {
        // Skip caching if the promise is replaced or deleted
        // before it resolves.
        if (promise == cache.loading[cacheKey]) {
          delete cache.loading[cacheKey]

          const { maxAge } = entryConfig
          if (maxAge > 0) {
            cache.loaded[cacheKey] = isFinite(maxAge)
              ? [state, Date.now() + maxAge * 1e3]
              : [state]
          } else {
            debug('State %s expired while loading, skipping cache', cacheKey)
          }
        }
        onLoad(state)
      },
      error => {
        if (promise == cache.loading[cacheKey]) {
          delete cache.loading[cacheKey]
        }
        onError(error)
      }
    )

    return deepCopy(promise, options?.deepCopy)
  }
}

function deepCopy<T>(promise: Promise<T>, enabled = false): typeof promise {
  return enabled ? promise.then(klona) : promise
}
