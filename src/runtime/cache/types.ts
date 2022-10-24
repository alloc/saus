import { Promisable } from 'type-fest'
import { CachePlugin } from '../cachePlugin'
import type { StateModule } from '../stateModules'
import { access, get, has, load } from './access'
import { clear } from './clear'
import { forEach } from './forEach'

export type Cache<State = unknown> = {
  listeners: Record<string, Set<Cache.Listener>>
  loading: Record<string, Cache.EntryPromise<State>>
  loaded: Record<string, Cache.Entry<State>>
  has: typeof has
  get: typeof get
  load: typeof load
  access: typeof access
  clear: typeof clear
  forEach: typeof forEach
  plugin?: CachePlugin
}

export namespace Cache {
  /**
   * The internal data structure used by `Cache` type.
   */
  export interface Entry<State = unknown, Args extends readonly any[] = any> {
    /**
     * The generated data.
     */
    state: State
    /**
     * The UNIX timestamp for when this entry was generated.
     */
    timestamp: number
    /**
     * The number of seconds until the entry expires.
     *
     * Note: Expired entries remain in the cache until the next access
     * call, so their expired data can be provided to the entry loader.
     */
    maxAge?: MaxAge
    /**
     * An array of arguments that were used to generate the
     * cache key.
     */
    args?: Args
    /**
     * This entry is invalidated when any of these files are changed in
     * development.
     *
     * ⚠️ Exists in server context only.
     */
    deps?: readonly string[]
    /**
     * The state module used to generate this entry.
     *
     * ⚠️ Exists in server context only.
     */
    stateModule?: StateModule
  }

  export type MaxAge = number | null | undefined

  export type EntryContext<State = unknown> =
    import('./context').EntryContext<State>

  export interface EntryPromise<State>
    extends globalThis.Promise<Entry<State>> {
    cancel: () => void
  }

  export type Listener<State = unknown, Args extends readonly any[] = any> = (
    state: State,
    entry: Cache.Entry<State, Args>
  ) => void

  export type EntryLoader<State = unknown> = {
    (ctx: EntryContext<State>): Promisable<State>
  }

  export interface AccessOptions
    extends Pick<Entry, 'args' | 'deps' | 'stateModule'> {
    /**
     * Return expired data (if possible) instead of loading new data.
     */
    acceptExpired?: boolean
    /**
     * Skip calling `this.plugin.get` and `this.plugin.put` hooks
     * provided by `injectCachePlugin` call.
     *
     * ⚠️ Used in server context only.
     */
    bypassPlugin?: boolean
    /**
     * When this state is accessed in a server context,
     * it will be deep-copied so it can be mutated in preparation
     * for page rendering without mutating the serialized data
     * that goes in the client module.
     */
    deepCopy?: boolean
    /**
     * Call this function when loading the state instead of reusing it
     * from the cache.
     */
    onLoad?: (entry: Cache.Entry<any>) => void
  }
}
