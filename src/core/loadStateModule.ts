import { loadedStateCache, loadingStateCache } from '../client/cache'
import { unwrapDefault } from '../utils/unwrapDefault'
import { withCache } from './withCache'

export const loadState = withCache(loadingStateCache, loadedStateCache)

export const loadStateModule = (
  cacheKey: string,
  loadImpl: (...args: any[]) => any,
  ...args: any[]
) =>
  loadState(cacheKey, async function loadStateModule() {
    try {
      let result = loadImpl(...args)
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
