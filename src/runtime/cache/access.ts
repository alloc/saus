import { AbortController } from '@utils/AbortController'
import { klona } from '@utils/klona'
import { noop } from '@utils/noop'
import { CachePlugin } from '../cachePlugin'
import { debug } from '../stateModules/debug'
import { EntryContext } from './context'
import { toExpirationTime } from './expiration'
import { Cache } from './types'

/**
 * Shortcut for `access` that checks whether a key is
 * either loading or loaded (and not expired).
 */
export function has<State>(this: Cache<State>, key: string): boolean {
  const loaded = this.loaded[key]
  return loaded
    ? toExpirationTime(loaded) - Date.now() > 0
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
      promise.then(({ state }) => state),
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
  loader: Cache.EntryLoader<LoadResult>,
  options?: Cache.AccessOptions
): Promise<LoadResult> {
  const promise = this.access(key, loader, options)
  return makePromiseCancellable(
    promise.then(({ state }) => state),
    promise.cancel
  )
}

export function access<State, LoadResult extends State>(
  this: Cache<State>,
  cacheKey: string,
  loader: Cache.EntryLoader<LoadResult>,
  options?: Cache.AccessOptions
): Cache.EntryPromise<LoadResult>

export function access<State>(
  this: Cache<State>,
  cacheKey: string,
  loader?: Cache.EntryLoader<State>,
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
  loaderArg?: Cache.EntryLoader<State> | Cache.AccessOptions,
  optionsArg?: Cache.AccessOptions
): Cache.EntryPromise<State> | undefined {
  let loader: Cache.EntryLoader<State> | undefined
  let options: Cache.AccessOptions
  if (typeof loaderArg == 'function') {
    loader = loaderArg
    options = optionsArg || {}
  } else {
    options = loaderArg || {}
  }

  let entry: Cache.Entry<State> | undefined = this.loaded[cacheKey]
  if (entry) {
    if (options.acceptExpired) {
      return resolveEntry(entry, options)
    }
    const expiresAt = toExpirationTime(entry)
    if (expiresAt - Date.now() > 0) {
      return resolveEntry(entry, options)
    }
  }

  const oldPromise = this.loading[cacheKey] as
    | Cache.EntryPromise<State>
    | undefined

  if (oldPromise || !loader) {
    return oldPromise && resolveEntry(oldPromise, options, oldPromise.cancel)
  }

  const abortCtrl = new AbortController()
  const pluginPromise =
    !options.skipCachePlugin && CachePlugin.get
      ? CachePlugin.get(cacheKey, abortCtrl.signal)
      : undefined

  const context = new EntryContext(cacheKey, entry?.state, abortCtrl.signal)

  const promise = Promise.resolve(pluginPromise)
    .catch(err => {
      err.cacheKey = cacheKey
      console.error(err)
    })
    .then(async entry => {
      if (entry) {
        this.loaded[cacheKey] = entry
        return entry
      }
      entry = {
        state: null as any,
        timestamp: Date.now(),
        args: options.args,
        deps: options.deps,
        stateModule: options.stateModule,
      }
      const state = await loader!(context)
      if (context.skipped) {
        return this.loaded[cacheKey]
      }
      entry.state = state
      entry.maxAge = isFinite(context.maxAge) ? context.maxAge : undefined
      return entry
    })

  const cancel = abortCtrl.abort.bind(abortCtrl)
  this.loading[cacheKey] = resolveEntry(promise, null, cancel)

  promise.then(
    entry => {
      if (promise !== this.loading[cacheKey]) {
        return // This promise was replaced or deleted.
      }
      delete this.loading[cacheKey]
      if (context.skipped) {
        return
      }
      if (context.maxAge > 0) {
        this.loaded[cacheKey] = entry
        if (CachePlugin.put) {
          CachePlugin.pendingPuts.set(
            cacheKey,
            Promise.resolve(CachePlugin.put(cacheKey, entry))
              .catch(console.error)
              .then(() => {
                CachePlugin.pendingPuts.delete(cacheKey)
              })
          )
        }
      } else {
        debug('State %s expired while loading, skipping cache', cacheKey)
      }
    },
    () => {
      if (promise == this.loading[cacheKey]) {
        delete this.loading[cacheKey]
      }
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
  options: Cache.AccessOptions | null,
  cancel: () => void = noop
): Cache.EntryPromise<State> {
  let promise = entry instanceof Promise ? entry : Promise.resolve(entry)
  if (options?.deepCopy) {
    promise = promise.then(klona)
  }
  return makePromiseCancellable(promise, cancel)
}
