import createDebug from 'debug'
import { klona as deepCopy } from 'klona'
import { unwrapDefault } from '../utils/unwrapDefault'
import { CachePlugin } from './cachePlugin'
import { getCachedState } from './getCachedState'
import { getLoadedStateOrThrow } from './getLoadedStateOrThrow'
import type { ResolvedState } from './stateModules'
import type { CacheControl } from './withCache'

const debug = createDebug('saus:cache')

export const stateModuleArguments = new Map<string, any[]>()

export type StateModuleLoader<T = any, Args extends any[] = any[]> = (
  this: CacheControl,
  ...args: Args
) => T

/** @internal */
export function loadStateModule<T, Args extends any[]>(
  _id: string,
  args: Args,
  loadImpl: StateModuleLoader<T, Args> | false,
  toCacheKey: (args: any[]) => string
): Promise<ResolvedState<T>> {
  const cacheKey = toCacheKey(args)

  if (!loadImpl) {
    const cached = getLoadedStateOrThrow(cacheKey, args)
    return deepCopy(cached[0])
  }

  const loadStateModule = async (cacheControl: CacheControl) => {
    debug(`Loading "%s" state`, cacheKey)
    console.log('loadStateModule: %s %s', cacheKey, args)
    try {
      let result: any
      if (CachePlugin.loader) {
        result = await CachePlugin.loader(cacheKey, cacheControl)
      }
      if (result === undefined) {
        result = loadImpl.apply(cacheControl, args)
        if (result && typeof result == 'object') {
          // When an array is returned, await its elements.
          if (Array.isArray(result)) {
            result = (await Promise.all(result)).map(unwrapDefault)
          }

          // When an object is returned, await its property values.
          else if (result.constructor == Object)
            await Promise.all(
              Object.keys(result).map(async key => {
                result[key] = unwrapDefault(await result[key])
              })
            )
          else {
            // When a promise is returned, await it.
            if (result.constructor == Promise) {
              result = await result
            }
            // When a module is returned/resolved and it only contains
            // a default export, unwrap the default export.
            result = unwrapDefault(result)
          }
        }
        if (CachePlugin.put) {
          const expiresAt = Date.now() + cacheControl.maxAge * 1e3
          await CachePlugin.put(cacheKey, result, expiresAt)
        }
      }
      stateModuleArguments.set(cacheKey, args)
      return result
    } catch (error: any) {
      throw error && 'message' in error
        ? Object.assign(error, { stateModuleKey: cacheKey })
        : error
    }
  }

  return getCachedState(cacheKey, loadStateModule, {
    deepCopy: true,
  })
}
