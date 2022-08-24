import { Promisable } from 'type-fest'
import { access, get, has, load } from './access'
import { CacheControl } from './cacheControl'
import { clear } from './clear'
import { forEach } from './forEach'

export type Cache<State = unknown> = {
  loading: Record<string, Cache.EntryPromise<State>>
  loaded: Record<string, Cache.Entry<State>>
  has: typeof has
  get: typeof get
  load: typeof load
  access: typeof access
  clear: typeof clear
  forEach: typeof forEach
}

export namespace Cache {
  /**
   * The internal data structure used by `Cache` type.
   *
   * The `args` property doesn't exist for URL-based state.
   */
  export type Entry<State = unknown> = [
    state: State,
    expiresAt?: number | null,
    args?: readonly any[]
  ]

  export interface EntryPromise<State>
    extends globalThis.Promise<Entry<State>> {
    cancel: () => void
  }

  export type StateLoader<State = unknown> = {
    (cacheControl: CacheControl<State>): Promisable<State>
  }

  export interface AccessOptions<State = unknown> {
    /**
     * When this state is accessed in a server context,
     * it will be deep-copied so it can be mutated in preparation
     * for page rendering without mutating the serialized data
     * that goes in the client module.
     */
    deepCopy?: boolean
    /**
     * An array of arguments that were used to generate the
     * cache key.
     *
     * At the moment, this property is only used when rendering
     * state modules in a server context.
     */
    args?: readonly any[]
  }
}
