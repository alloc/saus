import type { ClientState, ResolvedState, StateFragment } from '../core'
import { states } from './cache'

let initialState: ClientState

declare const document: { querySelector: (selector: string) => any }

if (!import.meta.env.SSR) {
  const stateScript = document.querySelector('#initial-state')
  initialState = JSON.parse(stateScript.textContent)
  stateScript.remove()

  const pageUrl =
    location.pathname.slice(import.meta.env.BASE_URL.length - 1) +
    location.search

  states[pageUrl] = Promise.resolve(initialState)
}

/**
 * Load client state for the given URL, using the local cache if possible.
 *
 * The `url` must not contain either a hash fragment (eg: `#foo`) or
 * search query (eg: `?foo`).
 */
function loadClientState(url: string): Promise<ClientState> {
  let state = states[url]
  if (!state && typeof fetch !== 'undefined') {
    const stateUrl = url.replace(/\/?$/, '/state.json')
    state = states[url] = fetch(stateUrl).then(res => res.json())
  }
  return state
}

export { initialState, loadClientState }
export type { ClientState }

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
    return [prefix, ...args].join(':')
  }
  return {
    get(...args) {
      const key = toCacheKey(args)
      const state: any = states[key]
      if (state && prefix in state) {
        return state[prefix]
      }
      throw Error(
        `Failed to access "${key}" state. ` +
          `This fragment is not included by the route config.`
      )
    },
    async load(...args) {
      const key = toCacheKey(args)
      if (key in states) {
        return states[key]
      }
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
      states[key] = result
      return result
    },
    bind(...args) {
      return {
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
