import { klona as deepCopy } from '@/utils/klona'
import createDebug from 'debug'
import { Cache, CacheControl } from '../cache'
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
export function getState<T, Args extends readonly any[]>(
  cache: Cache,
  module: StateModule<T, Args, any>,
  args: Args
) {
  const cached = getLoadedStateOrThrow(cache, module.key, args)
  return deepCopy(cached) as Cache.Entry<T>
}

export function serveState<T>(
  cache: Cache,
  module: StateModule<any, [], T>
): Cache.EntryPromise<T>

export function serveState<T, Args extends readonly any[]>(
  cache: Cache,
  module: StateModule<any, Args, T>,
  args: Args
): Cache.EntryPromise<T>

export function serveState(
  cache: Cache,
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
      stateModuleArguments.set(key, args)
      return result
    } catch (error: any) {
      throw error && 'message' in error
        ? Object.assign(error, { stateModule: { cacheKey: key, args } })
        : error
    }
  }

  return cache.access(key, loadStateModule, {
    deepCopy: true,
    args,
  })
}

export function loadState<T>(
  cache: Cache,
  module: StateModule<T, [], any>
): Cache.EntryPromise<T>

export function loadState<T, Args extends readonly any[]>(
  cache: Cache,
  module: StateModule<T, Args, any>,
  args: Args
): Cache.EntryPromise<T>

export async function loadState(
  cache: Cache,
  module: StateModule,
  args: readonly any[] = module.args || []
) {
  const served = await serveState(cache, module, args)
  const hydrate = module['_hydrate']
  if (hydrate) {
    let [state, expiresAt] = served
    state = await hydrate(args, state, expiresAt)
    return [state, expiresAt, args]
  }
  return served
}
