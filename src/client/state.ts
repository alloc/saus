import {
  ClientState,
  kStateFragment,
  ResolvedState,
  StateFragment,
} from '../core'
import { loadedStateCache, loadingStateCache } from './cache'
import { unpackStateFragments } from './unpack'
import { withCache } from './withCache'

/**
 * Load client state for the given URL, using the local cache if possible.
 *
 * The `pageUrl` argument must not contain either a hash fragment (eg: `#foo`)
 * or a search query (eg: `?foo`).
 */
export const loadClientState: {
  (pageUrl: string): Promise<ClientState>
  /**
   * Use the same cache that Saus keeps page-specific state in.
   */
  <T>(cacheKey: string, loader: () => Promise<T>): Promise<T>
} = withCache(loadingStateCache, loadedStateCache, pageUrl => {
  if (pageUrl[0] == '/' && typeof fetch !== 'undefined') {
    const stateUrl = pageUrl.replace(/\/?$/, '/state.json')
    return () =>
      fetch(stateUrl).then(async res => {
        const state = await res.json()
        unpackStateFragments(state)
        return state
      })
  }
})

export type { ClientState, StateFragment }

export const isStateFragment = (arg: any): arg is StateFragment =>
  !!(arg && arg[kStateFragment])

/**
 * State isolates are loaded at compile time. Their loader function receives the
 * top-level state for the current page route. They are stored within the hydration
 * JSON state using a globally unique identifier.
 *
 * To share isolates between pages, simply omit the `pageUrl` argument when calling
 * the `get` and `load` methods.
 */
export function defineStateFragment<T, Args extends any[]>(
  prefix: string,
  loadImpl: (...args: Args) => T
): StateFragment<ResolvedState<T>, Args> {
  function toCacheKey(args: any[]) {
    return prefix + '∫' + JSON.stringify(args)
  }
  return {
    [kStateFragment]: true,
    prefix,
    get(...args) {
      const cacheKey = toCacheKey(args)
      if (loadedStateCache.has(cacheKey)) {
        return loadedStateCache.get(cacheKey)
      }
      throw Error(
        `Failed to access "${cacheKey}" state. ` +
          `This fragment is not included by the route config.`
      )
    },
    load(...args) {
      const cacheKey = toCacheKey(args)
      return loadClientState(cacheKey, async () => {
        try {
          let result: any = loadImpl(...args)
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
          const errorPrefix = `[saus] Failed to load "${cacheKey}" state fragment.`
          if (e instanceof Error) {
            e.message = errorPrefix + ' ' + e.message
          } else if (e && !import.meta.env.SSR) {
            console.error(errorPrefix)
          } else {
            e = new Error(errorPrefix)
          }
          throw e
        }
      })
    },
    bind(...args) {
      return {
        [kStateFragment]: true,
        prefix: toCacheKey(args),
        get: (this.get as Function).bind(this, ...args),
        load: (this.load as Function).bind(this, ...args),
        bind() {
          throw Error('Cannot bind arguments twice')
        },
      }
    },
  }
}

export function unwrapDefault(module: any) {
  const props = Object.getOwnPropertyNames(module)
  if (props.length == 1 && props[0] == 'default') {
    return module.default
  }
  return module
}

export async function resolveModules<T extends Promise<any>[]>(
  ...modules: T
): Promise<ResolvedState<T>> {
  return (await Promise.all(modules)).map(unwrapDefault) as any
}
