import md5Hex from 'md5-hex'
import type { ClientState } from '../client'
import { loadedStateCache } from './cache'
import { loadStateModule, StateModuleLoader } from './loadStateModule'
import type { ResolvedState } from './state'

export const stateModulesMap = new WeakMap<ClientState, string[]>()

export interface StateModule<T = any, Args extends any[] = any[]> {
  id: string
  load(...args: Args): Promise<T>
  bind(...args: Args): StateModule<T, []>
  get(...args: Args): T
}

const kStateModule = Symbol.for('saus.StateModule')

export const isStateModule = (arg: any): arg is StateModule =>
  !!(arg && arg[kStateModule])

/**
 * State modules are loaded at compile time. Any arguments passed to their loader
 * functions must be JSON-compatible. Once loaded, these modules are injected into
 * pages whose route includes them.
 */
export function defineStateModule<T, Args extends any[]>(
  id: string,
  loadImpl: StateModuleLoader<T, Args>
): StateModule<ResolvedState<T>, Args> {
  function toCacheKey(args: any[]) {
    return id + '.' + md5Hex(JSON.stringify(args)).slice(0, 8)
  }
  return {
    // @ts-ignore
    [kStateModule]: true,
    id: toCacheKey([]),
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
      return loadStateModule(cacheKey, loadImpl, ...args)
    },
    bind(...args) {
      return {
        [kStateModule]: true,
        id: toCacheKey(args),
        get: (this.get as Function).bind(this, ...args),
        load: (this.load as Function).bind(this, ...args),
        bind() {
          throw Error('Cannot bind arguments twice')
        },
      }
    },
  }
}
