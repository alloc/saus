import { AbortController } from '@/utils/AbortController'
import { klona } from 'klona'
import { Promisable } from 'type-fest'
import { debug } from '../../debug'
import { noop } from '../../utils/noop'
import { CacheControl } from './cacheControl'
import { Cache } from './types'

/**
 * Shortcut for `access` that checks whether a key is
 * either loading or loaded (and not expired).
 */
export function has<State>(this: Cache<State>, key: string): boolean {
  const loaded = this.loaded[key]
  return loaded
    ? (loaded[1] ?? Infinity) - Date.now() > 0
    : this.loading[key] !== undefined
}

/**
 * Shortcut for `access` that unwraps the raw state.
 * You get `undefined` if a key is either missing or expired.
 */
export function get<State>(
  this: Cache<State>,
  key: string,
  options?: Cache.AccessOptions
): Promise<State> | undefined {
  const promise = this.access(key, options)
  if (promise) {
    return makePromiseCancellable(
      promise.then(([state]) => state),
      promise.cancel
    )
  }
}

/**
 * Shortcut for `access` that unwraps the raw state.
 * The given `loader` is called unless a value is already cached
 * (and not expired).
 */
export function load<State, LoadResult extends State>(
  this: Cache<State>,
  key: string,
  loader: Cache.StateLoader<LoadResult>,
  options?: Cache.AccessOptions
): Promise<LoadResult> {
  const promise = this.access(key, loader, options)
  return makePromiseCancellable(
    promise.then(([state]) => state),
    promise.cancel
  )
}

export function access<State, LoadResult extends State>(
  this: Cache<State>,
  cacheKey: string,
  loader: Cache.StateLoader<LoadResult>,
  options?: Cache.AccessOptions
): Cache.EntryPromise<LoadResult>

export function access<State>(
  this: Cache<State>,
  cacheKey: string,
  loader?: Cache.StateLoader<State>,
  options?: Cache.AccessOptions
): Cache.EntryPromise<State> | undefined

export function access<State>(
  this: Cache<State>,
  cacheKey: string,
  options?: Cache.AccessOptions
): Cache.EntryPromise<State> | undefined

export function access<State>(
  this: Cache<State>,
  cacheKey: string,
  optionsOrLoader?: Cache.StateLoader<State> | Cache.AccessOptions,
  options?: Cache.AccessOptions
): Cache.EntryPromise<State> | undefined {
  let loader: Cache.StateLoader<State> | undefined
  if (typeof optionsOrLoader == 'function') {
    loader = optionsOrLoader
  } else if (optionsOrLoader) {
    options = optionsOrLoader
  }

  let entry = this.loaded[cacheKey]
  if (entry) {
    const expiresAt = entry[1] ?? Infinity
    if (expiresAt - Date.now() > 0) {
      return resolveEntry(entry, options)
    }
  }

  const oldPromise = this.loading[cacheKey]
  if (oldPromise || !loader) {
    return oldPromise && resolveEntry(oldPromise, options, oldPromise.cancel)
  }

  let cacheCtrl!: CacheControl<State>
  let loadResult!: Promisable<State>
  let onLoad!: (entry: Cache.Entry<State>) => void
  let onError: (e: any) => void

  const abortCtrl = new AbortController()
  const promise = new Promise<Cache.Entry<State>>((resolve, reject) => {
    cacheCtrl = new CacheControl(cacheKey, entry?.[0], abortCtrl.signal)
    loadResult = loader!(cacheCtrl)
    onLoad = resolve
    onError = reject
  })

  // If the loader is synchronous and threw an error,
  // the `onLoad` variable won't be defined.
  if (!onLoad) {
    return resolveEntry(promise, options)
  }

  // Avoid updating the cache if an old value is returned.
  if (loadResult === cacheCtrl.oldValue) {
    onLoad(toEntry(loadResult, cacheCtrl.expiresAt))
    return resolveEntry(promise, options)
  }

  const cancel = abortCtrl.abort.bind(abortCtrl)
  this.loading[cacheKey] = resolveEntry(promise, undefined, cancel)
  this.loaders[cacheKey] = loader

  Promise.resolve(loadResult).then(
    state => {
      entry = toEntry(state, cacheCtrl.expiresAt)
      onLoad(entry)

      // Skip caching if the promise is replaced or deleted
      // before it resolves.
      if (promise == this.loading[cacheKey]) {
        delete this.loading[cacheKey]
        if (cacheCtrl.maxAge > 0) {
          this.loaded[cacheKey] = entry
        } else {
          debug('State %s expired while loading, skipping cache', cacheKey)
        }
      }
    },
    error => {
      if (promise == this.loading[cacheKey]) {
        delete this.loading[cacheKey]
      }
      onError(error)
    }
  )

  return resolveEntry(promise, options, cancel)
}

function makePromiseCancellable<T>(
  promise: Promise<T>,
  cancel: () => void
): Promise<T> & {
  cancel(): void
} {
  const cachePromise = promise as any
  cachePromise.cancel = cancel
  return cachePromise
}

function resolveEntry<State>(
  entry: Cache.Entry<State> | Promise<Cache.Entry<State>>,
  options?: Cache.AccessOptions,
  cancel: () => void = noop
): Cache.EntryPromise<State> {
  let promise = Array.isArray(entry) ? Promise.resolve(entry) : entry
  if (options?.deepCopy) {
    promise = promise.then(klona)
  }
  return makePromiseCancellable(promise, cancel)
}

function toEntry<State = unknown>(
  state: Promise<State>,
  expiresAt: number | null | undefined
): Promise<Cache.Entry<State>>

function toEntry<State = unknown>(
  state: State,
  expiresAt: number | null | undefined
): Cache.Entry<State>

function toEntry(
  state: any,
  expiresAt: number | null | undefined
): Cache.Entry | Promise<Cache.Entry> {
  return state instanceof Promise
    ? state.then(state => toEntry(state, expiresAt))
    : expiresAt == null
    ? [state]
    : [state, expiresAt]
}
