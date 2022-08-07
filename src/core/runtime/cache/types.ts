import { Promisable } from 'type-fest'
import { access, get, has, load } from './access'
import { CacheControl } from './cacheControl'
import { clear } from './clear'
import { forEach } from './forEach'

export type Cache<State = unknown> = {
  loaders: Record<string, Cache.StateLoader<State>>
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
  /** The internal data structure used by `Cache` type */
  export type Entry<State = unknown> = [state: State, expiresAt?: number]

  export interface EntryPromise<State>
    extends globalThis.Promise<Entry<State>> {
    cancel: () => void
  }

  export type StateLoader<State = unknown> = {
    (cacheControl: CacheControl<State>): Promisable<State>
  }

  export interface AccessOptions {
    /**
     * When this state is accessed in a server context,
     * it will be deep-copied so it can be mutated in preparation
     * for page rendering without mutating the serialized data
     * that goes in the client module.
     */
    deepCopy?: boolean
  }
}
