import { md5Hex } from '../utils/md5-hex'
import { sortObjects } from '../utils/sortObjects'
import { loadStateModule, StateModuleLoader } from './loadStateModule'

export { useCachePlugin } from './cachePlugin'

export const stateModulesById = new Map<string, StateModule>()

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
    let cacheKey = id
    if (args.length) {
      const hash = md5Hex(JSON.stringify(args, sortObjects))
      cacheKey += '.' + hash.slice(0, 8)
    }
    return cacheKey
  }
  const stateModule: StateModule = {
    // @ts-ignore
    [kStateModule]: true,
    id: toCacheKey([]),
    get(...args) {
      return loadStateModule(id, args as Args, false, toCacheKey)
    },
    load(...args) {
      return loadStateModule(id, args as Args, loadImpl, toCacheKey)
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
  stateModulesById.set(id, stateModule)
  return stateModule
}

export type ResolvedState<T> = T extends Promise<any>
  ? Resolved<T>
  : T extends ReadonlyArray<infer Element>
  ? Element[] extends T
    ? readonly Resolved<Element>[]
    : { [P in keyof T]: Resolved<T[P]> }
  : T extends object
  ? { [P in keyof T]: Resolved<T[P]> }
  : ResolvedModule<T>

type Resolved<T> = ResolvedModule<T extends Promise<infer U> ? U : T>

type ResolvedModule<T> = T extends { default: infer DefaultExport }
  ? { default: DefaultExport } extends T
    ? DefaultExport
    : T
  : T