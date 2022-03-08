import createDebug from 'debug'
import type { CacheControl } from '../core/withCache'
import { unwrapDefault } from '../utils/unwrapDefault'
import { getCachedState } from './getCachedState'
import type { ResolvedState } from './stateModules'

const debug = createDebug('saus:cache')

export type StateModuleLoader<T = any, Args extends any[] = any[]> = (
  this: CacheControl,
  ...args: Args
) => T

/** @internal */
export function loadStateModule<T, Args extends any[]>(
  _id: string,
  args: Args,
  loadImpl: StateModuleLoader<T, Args>,
  toCacheKey: (args: any[]) => string
): Promise<ResolvedState<T>> {
  const cacheKey = toCacheKey(args)
  return getCachedState(cacheKey, async function loadStateModule(cacheControl) {
    debug(`Loading "%s" state`, cacheKey)
    try {
      let result: any = loadImpl.apply(cacheControl, args)
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
      return result
    } catch (error: any) {
      throw error && 'message' in error
        ? Object.assign(error, { stateModuleKey: cacheKey })
        : error
    }
  })
}
