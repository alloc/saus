import { unwrapDefault } from '../utils/unwrapDefault'
import { loadedStateCache, loadingStateCache } from './cache'
import type { ResolvedState } from './state'
import { TimeToLive } from './ttl'
import { withCache } from './withCache'

export type StateModuleContext = {
  cacheKey: string
  /** Set the time-to-live (in seconds) */
  maxAge: number
}

const getStateModuleContext = (cacheKey: string): StateModuleContext => ({
  cacheKey,
  get maxAge() {
    return Infinity
  },
  set maxAge(value) {
    TimeToLive.set(cacheKey, value)
    Object.defineProperty(this, 'maxAge', { value })
  },
})

export type StateModuleLoader<T = any, Args extends any[] = any[]> = (
  this: StateModuleContext,
  ...args: Args
) => T

export const loadState = withCache(loadingStateCache, loadedStateCache) as {
  <State = any>(cacheKey: string): Promise<State | undefined>
  <State = any>(cacheKey: string, loader: () => Promise<State>): Promise<State>
}

export const loadStateModule = <T, Args extends any[]>(
  cacheKey: string,
  loadImpl: StateModuleLoader<T, Args>,
  ...args: Args
): Promise<ResolvedState<T>> =>
  loadState(cacheKey, async function loadStateModule() {
    try {
      let result: any = loadImpl.apply(getStateModuleContext(cacheKey), args)
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
    } catch (e: any) {
      const errorPrefix = `[saus] Failed to load "${cacheKey}" state module.`
      if (e instanceof Error) {
        e.message = errorPrefix + ' ' + e.message
      } else {
        e = new Error(errorPrefix)
      }
      throw e
    }
  })
