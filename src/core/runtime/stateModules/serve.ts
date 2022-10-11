import createDebug from 'debug'
import { Cache, CacheControl, createCache } from '../cache'
import { CachePlugin } from '../cachePlugin'
import { getStateModuleKey } from '../getStateModuleKey'
import type { StateModule } from '../stateModules'

const debug = createDebug('saus:state')

/**
 * Data served by state modules is cached here.
 *
 * Hydrated data is stored in the global cache.
 */
export const serveCache = createCache()

export function serveState<T>(
  module: StateModule<any, [], T>
): Cache.EntryPromise<T>

export function serveState<T, Args extends readonly any[]>(
  module: StateModule<any, Args, T>,
  args: Args
): Cache.EntryPromise<T>

export function serveState(
  module: StateModule,
  args: readonly any[] = module.args || []
) {
  const key = getStateModuleKey(module, args)
  const loadStateModule = async (cacheControl: CacheControl) => {
    debug(`Loading "%s" state with arguments:`, key, args)
    const timestamp = Date.now()
    try {
      let result: any
      if (CachePlugin.loader) {
        result = await CachePlugin.loader(key, cacheControl)
      }
      if (result === undefined) {
        result = module['_serve']!.apply(cacheControl, args as any)
        if (result && typeof result.then == 'function') {
          result = await result
        }
        if (CachePlugin.put) {
          const expiresAt = Date.now() + cacheControl.maxAge * 1e3
          // TODO: delay the response so page rendering doesn't have to
          // wait for upload unnecessarily
          await CachePlugin.put(key, result, expiresAt)
        }
      }
      debug(
        `Loaded "%s" state in %ss`,
        key,
        ((Date.now() - timestamp) / 1e3).toFixed(3)
      )
      return result
    } catch (error: any) {
      throw error && 'message' in error
        ? Object.assign(error, { stateModule: { cacheKey: key, args } })
        : error
    }
  }

  return serveCache.access(key, loadStateModule, {
    deepCopy: true,
    args,
  })
}
