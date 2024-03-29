import { createCache } from '../cache/create'
import { Cache } from '../cache/types'
import { getStateModuleKey } from '../getStateModuleKey'
import type { StateModule } from '../stateModules'
import { debug } from './debug'

interface ServeStatePromise<State>
  extends globalThis.Promise<StateModule.CacheEntry<State>> {
  cancel: () => void
}

/**
 * Data served by state modules is cached here.
 *
 * Hydrated data is stored in the global cache.
 */
export const serveCache = createCache()

export function serveState<T>(
  module: StateModule<any, any, T>,
  options: Cache.AccessOptions = {}
): ServeStatePromise<T> {
  const args = options.args || module.args || []
  const key = getStateModuleKey(module, args)
  const loadStateModule = async (entry: Cache.EntryContext<T>) => {
    debug(`Loading "%s" state with arguments:`, key, args)
    try {
      let result: any = module['_serve']!.apply(entry, args as any)
      if (result && typeof result.then == 'function') {
        result = await result
      }
      debug(
        `Loaded "%s" state in %ss`,
        key,
        ((Date.now() - entry.timestamp) / 1e3).toFixed(3)
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
    ...options,
    stateModule: module,
    args,
  }) as any
}
