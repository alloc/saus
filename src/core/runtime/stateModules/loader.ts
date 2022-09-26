import { klona as deepCopy } from '@/utils/klona'
import createDebug from 'debug'
import { Cache, CacheControl, globalCache } from '../cache'
import { CachePlugin } from '../cachePlugin'
import { getLoadedStateOrThrow } from '../getLoadedStateOrThrow'
import { getStateModuleKey } from '../getStateModuleKey'
import type { StateModule } from '../stateModules'

const debug = createDebug('saus:state')

export const stateModuleArguments = new Map<string, readonly any[]>()

/**
 * Unwrap a state module with the given arguments. \
 * Throws an error when the state isn't already loaded.
 */
export function loadStateModule<T, Args extends readonly any[]>(
  module: StateModule<T, Args>,
  args: Args,
  sync: true
): Cache.Entry<T>

/** Load a state module with bound arguments (or no arguments). */
export function loadStateModule<T>(
  module: StateModule<T, []>
): Cache.EntryPromise<T>

/** Load a state module with the given arguments. */
export function loadStateModule<T, Args extends readonly any[]>(
  module: StateModule<T, Args>,
  args: Args
): Cache.EntryPromise<T>

/** @internal */
export function loadStateModule<Args extends readonly any[]>(
  module: StateModule<any, Args>,
  args = (module.args || []) as Args,
  sync?: boolean
): any {
  const cacheKey = getStateModuleKey(module, args)

  if (sync) {
    const cached = getLoadedStateOrThrow(cacheKey, args)
    return deepCopy(cached)
  }

  const loadStateModule = async (cacheControl: CacheControl) => {
    debug(`Loading "%s" state with arguments:`, cacheKey, args)
    const timestamp = Date.now()
    try {
      let result: any
      if (CachePlugin.loader) {
        result = await CachePlugin.loader(cacheKey, cacheControl)
      }
      if (result === undefined) {
        result = (module.loader as StateModule.Loader).apply(
          cacheControl,
          args as any
        )
        if (result && typeof result.then == 'function') {
          result = await result
        }
        if (CachePlugin.put) {
          const expiresAt = Date.now() + cacheControl.maxAge * 1e3
          // TODO: delay the response so page rendering doesn't have to wait for upload unnecessarily
          await CachePlugin.put(cacheKey, result, expiresAt)
        }
      }
      debug(
        `Loaded "%s" state in %ss`,
        cacheKey,
        ((Date.now() - timestamp) / 1e3).toFixed(3)
      )
      stateModuleArguments.set(cacheKey, args)
      return result
    } catch (error: any) {
      throw error && 'message' in error
        ? Object.assign(error, { stateModule: { cacheKey, args } })
        : error
    }
  }

  return globalCache.access(cacheKey, loadStateModule, {
    deepCopy: true,
    args,
  })
}
