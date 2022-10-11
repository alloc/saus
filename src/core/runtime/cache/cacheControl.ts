import type { Cache } from './types'

/**
 * Used to control the cache behavior from within a state loader.
 */
export class CacheControl<State = unknown> {
  /**
   * Number of seconds until this entry is reloaded on next request.
   * Once expired, the loaded value remains in the cache until another
   * value is loaded.
   *
   * The state is cached in-memory in both client and server contexts.
   * If using a serverless function, the state is *not* shared between
   * invocations, unless you use a cache plugin.
   *
   * @default 3600 (1 hour)
   */
  maxAge = 3600

  constructor(
    /** The string used to identify this entry */
    readonly key: string,
    /**
     * The last loaded value that is now expired.
     */
    readonly oldValue: State | undefined,
    /**
     * Used for cancellation purposes.
     */
    readonly signal: AbortSignal
  ) {}

  /**
   * The Unix timestamp for when this entry expires.
   */
  get expiresAt(): Cache.EntryExpiration {
    const maxAge = Math.max(0, this.maxAge)
    return maxAge !== Infinity ? Date.now() + maxAge * 1e3 : null
  }

  set expiresAt(value) {
    this.maxAge =
      value == null ? Infinity : Math.max(0, value - Date.now()) / 1e3
  }
}
