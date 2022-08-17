import { CacheControl, setState } from './cache'
import { getStateModuleKey } from './getStateModuleKey'
import { loadStateModule } from './loadStateModule'
import { createStateListener } from './stateListeners'

export const stateModulesById = new Map<string, StateModule>()

export interface StateModule<T = any, Args extends readonly any[] = any> {
  id: string
  /** Avoid using this directly. It doesn't exist in a client context. */
  loader: StateModule.Loader<T, Args>
  /** The arguments bound to this module. */
  args?: readonly any[]
  /** The module used when binding arguments. */
  parent?: StateModule<T>
  bind(...args: Args): StateModule<T, []>
  get(...args: Args): T
  set(args: Args, state: T, expiresAt?: number): void
  load(...args: Args): Promise<T>
  onLoad(cb: StateModule.LoadCallback<T, Args>): StateModule.LoadListener
}

export namespace StateModule {
  export type Loader<T = any, Args extends readonly any[] = any> = (
    this: CacheControl<T>,
    ...args: Args
  ) => T

  export type LoadListener = { dispose: () => void }
  export type LoadCallback<T = any, Args extends readonly any[] = any> = (
    args: Args,
    state: T,
    expiresAt?: number
  ) => void
}

const kStateModule = Symbol.for('saus.StateModule')

export const isStateModule = (arg: any): arg is StateModule<any, any[]> =>
  !!(arg && arg[kStateModule])

/**
 * State modules are loaded at compile time. Any arguments passed to their loader
 * functions must be JSON-compatible. Once loaded, these modules are injected into
 * pages whose route includes them.
 */
export function defineStateModule<T, Args extends readonly any[]>(
  id: string,
  loader: StateModule.Loader<T, Args>
): StateModule<ResolvedState<T>, Args> {
  const stateModule: StateModule<any, Args> = {
    // @ts-ignore
    [kStateModule]: true,
    id,
    loader,
    get(...args) {
      return loadStateModule(this, args, true)[0]
    },
    set(args, state, expiresAt) {
      setState(this.id, args, state, expiresAt)
    },
    async load(...args) {
      const [state] = await loadStateModule(this, args)
      return state
    },
    onLoad(callback) {
      return createStateListener(id, callback)
    },
    bind(...args) {
      return {
        [kStateModule]: true,
        id: getStateModuleKey(this, args),
        loader,
        args,
        parent: this as any,
        get: (this.get as Function).bind(this, ...args),
        set: (this.set as Function).bind(this, args),
        load: (this.load as Function).bind(this, ...args),
        onLoad() {
          throw Error('Cannot call `onLoad` after binding arguments')
        },
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
