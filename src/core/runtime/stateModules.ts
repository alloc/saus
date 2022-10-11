import { Promisable } from 'type-fest'
import { Cache, CacheControl, globalCache, setState } from './cache'
import { getStateModuleKey } from './getStateModuleKey'
import { trackStateModule } from './stateModules/global'
import { hydrateStateListener } from './stateModules/listener'
import { getState, loadState, serveState } from './stateModules/loader'

/**
 * State modules are loaded at compile time. Any arguments passed to their loader
 * functions must be JSON-compatible. Once loaded, these modules are injected into
 * pages whose route includes them.
 */
export function defineStateModule<
  Args extends readonly any[],
  ServerState,
  ClientState = ServerState
>(
  name: string,
  config:
    | StateModule.ServeFunction<ServerState, Args>
    | StateModule.LoadConfig<ServerState, ClientState, Args>
): StateModule<ResolvedState<ClientState>, Args> {
  // @ts-expect-error 2673
  const module: StateModule = new StateModule(name, config)
  const hydrate = module['_hydrate']
  if (hydrate) {
    hydrateStateListener(module.name, hydrate)
  }
  trackStateModule(module)
  return module
}

export class StateModule<
  T = any,
  Args extends readonly any[] = any,
  Served = T
> {
  /**
   * The prefix used by all instances of this module.
   */
  readonly name: string
  /**
   * The cache key for this module.
   */
  readonly key: string
  /**
   * The arguments bound to this module.
   */
  readonly args?: readonly any[]
  /**
   * The module used when binding arguments.
   */
  readonly parent?: StateModule
  /**
   * The function passed to `new StateModule` that loads data in a
   * server context.
   *
   * If this function doesn't set `cacheControl.maxAge`
   * to `0` before its promise is resolved, the returned data will be
   * cached by the browser.
   *
   * ⚠️ Exists in server context only.
   */
  private _serve?: StateModule.ServeFunction<Served, Args>
  /**
   * The function passed to `new StateModule` that normalizes the served
   * data (in either a client or server context) so it's compatible with
   * the UI code that's used to render the page.
   */
  private _hydrate?: StateModule.HydrateFunction<Served, T, Args>

  private constructor(
    name: string,
    config?: StateModule.ServeFunction | StateModule.LoadConfig,
    parent?: StateModule,
    args?: readonly any[]
  ) {
    this.name = name
    if (parent) {
      this.parent = parent
      this.args = args
      this.key = getStateModuleKey(parent.name, args!)
    } else {
      this.key = name
    }
    if (config && typeof config !== 'function') {
      this._hydrate = config.hydrate
      this._serve = config.serve
    } else {
      this._serve = config
    }
  }

  /**
   * Bind arguments to a copy of this module.
   */
  bind(...args: Args): StateModule<T, [], Served> {
    if (this.parent) {
      throw Error('Cannot bind arguments twice')
    }
    const module = new StateModule(this.name, this._serve!, this, args)
    module._hydrate = this._hydrate
    return module
  }

  /**
   * Synchronously access all loaded instances of this module.
   */
  entries(): [key: string, cached: Cache.Entry][] {
    // TODO: escape moduleIds for regex syntax
    const cacheKeyPatterns = new RegExp('^(' + this.key + ')(\\.[^.]+)?$')
    return Object.entries(globalCache.loaded).filter(([key]) =>
      cacheKeyPatterns.test(key)
    )
  }

  /**
   * Synchronously access a specific instance of this module. If such an
   * instance is not yet loaded, this method will throw.
   */
  get(...args: Args): T {
    return getState(globalCache, this, args)[0]
  }

  /**
   * Manually update the cache for a specific instance of this module.
   */
  set(args: Args, state: T, expiresAt?: Cache.EntryExpiration): void {
    setState(this.name, args, state, expiresAt)
  }

  /**
   * Load the served data for this module. This data won't be hydrated.
   */
  async serve(...args: Args): Promise<Served> {
    const [state] = await serveState(globalCache, this, args)
    return state
  }

  /**
   * Load the hydrated data for this module. Works identically to
   * `.serve` if there exists no `hydrator` function.
   */
  async load(...args: Args): Promise<T> {
    const [state] = await loadState(globalCache, this, args)
    return state
  }

  /**
   * Attach a listener that runs only in a client context.
   *
   * ⚠️ If your UI framework needs client-side hydration, the listener
   * must not mutate the data it receives or affect any state that might
   * change how the UI is rendered.
   */
  onLoad(
    listener: StateModule.LoadCallback<T, Args>
  ): StateModule.LoadListener {
    const { name } = this
    globalCache.listeners[name] ||= new Set()
    globalCache.listeners[name].add(listener as any)
    hydrateStateListener(name, listener as any)
    return {
      dispose() {
        globalCache.listeners[name].delete(listener as any)
      },
    }
  }
}

export namespace StateModule {
  export type LoadConfig<
    Served = any,
    Hydrated = any,
    Args extends readonly any[] = any
  > = {
    serve: ServeFunction<Served, Args>
    hydrate: HydrateFunction<Served, Hydrated, Args>
  }

  export type ServeFunction<T = any, Args extends readonly any[] = any> = (
    this: CacheControl<T>,
    ...args: Args
  ) => Promisable<T>

  export type HydrateFunction<
    Served = any,
    Hydrated = any,
    Args extends readonly any[] = any
  > = (
    this: void,
    args: Args,
    state: Served,
    expiresAt: Cache.EntryExpiration
  ) => Promisable<Hydrated>

  export type LoadListener = { dispose: () => void }
  export type LoadCallback<T = any, Args extends readonly any[] = any> = (
    args: Args,
    state: T,
    expiresAt?: Cache.EntryExpiration
  ) => void
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
