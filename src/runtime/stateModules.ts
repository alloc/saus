import { NoInfer } from '@utils/types'
import { Promisable } from 'type-fest'
import { globalCache } from './cache/global'
import { Cache } from './cache/types'
import { getStateModuleKey } from './getStateModuleKey'
import { getState } from './stateModules/get'
import { trackStateModule } from './stateModules/global'
import { hydrateState, hydrateStateListener } from './stateModules/hydrate'
import { serveState } from './stateModules/serve'
import { setState } from './stateModules/setState'

type ServerArgs<T> = T extends StateModule.ServeFunction<any, infer Args>
  ? Args
  : never
type ServedState<T> = T extends StateModule.ServeFunction<infer Served>
  ? Served
  : never

/**
 * State modules are loaded at compile time. Any arguments passed to
 * their loader functions must be JSON-compatible. Once loaded, these
 * modules are injected into pages whose route includes them.
 */
export function defineStateModule<
  Server extends StateModule.ServeFunction,
  Hydrated = ServedState<Server>
>(
  name: string,
  config:
    | Server
    | {
        serve: Server
        hydrate: StateModule.HydrateFunction<
          ServedState<Server>,
          Hydrated,
          ServerArgs<Server>
        >
      }
): StateModule<Awaited<Hydrated>, ServerArgs<Server>, ServedState<Server>> {
  // @ts-expect-error 2673
  const module: StateModule = new StateModule(name, config)
  trackStateModule(module)
  return module
}

export type Hydrated<T extends StateModule> = //
  T extends StateModule<infer State> ? State : never

export class StateModule<
  Hydrated = any,
  Args extends readonly any[] = any,
  Served = Hydrated
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
  private _hydrate?: StateModule.HydrateFunction<Served, Hydrated, Args>

  private constructor(
    name: string,
    config?: StateModule.ServeFunction | StateModule.LoadConfig,
    parent?: StateModule,
    args?: readonly any[]
  ) {
    this.name = name
    if (parent && args) {
      this.parent = parent
      this.args = args
      this.key = getStateModuleKey(parent.name, args)
      this.get = (this.get as any).bind(this, ...args)
      this.load = (this.load as any).bind(this, ...args)
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
  bind(...args: Args): StateModule<Hydrated, [], Served> {
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
  get(...args: Args): Hydrated {
    return getState(globalCache, this, args).state
  }

  /**
   * Manually update the cache for a specific instance of this module.
   */
  set(
    args: Args,
    state: Served,
    timestamp = Date.now(),
    maxAge?: Cache.MaxAge
  ): void {
    setState(this.name, args, state, timestamp, maxAge)
  }

  /**
   * Load the served data for this module. This data won't be hydrated.
   */
  async serve(...args: Args): Promise<Served> {
    const served = await serveState(this, { args })
    return served.state
  }

  /**
   * Load the hydrated data for this module. Works identically to
   * `.serve` if there exists no `hydrator` function.
   *
   * ⚠️ Avoid calling this from another state module's `serve` function.
   * Prefer calling the `serve` method instead.
   */
  async load(...args: Args): Promise<Hydrated> {
    const key = getStateModuleKey(this.key, args)
    return globalCache.load(key, async entry => {
      const served = await serveState(this, { args })
      entry.maxAge = served.maxAge ?? Infinity
      return hydrateState(key, served, this, {
        deepCopy: true,
      })
    })
  }

  /**
   * Attach a listener that runs only in a client context.
   *
   * ⚠️ If your UI framework needs client-side hydration, the listener
   * must not mutate the data it receives or affect any state that might
   * change how the UI is rendered.
   */
  onLoad(
    listener: StateModule.LoadCallback<Hydrated, Args>
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
    hydrate: HydrateFunction<NoInfer<Served>, Hydrated, Args>
  }

  export type ServeFunction<T = any, Args extends readonly any[] = any> = (
    this: Cache.EntryContext<T>,
    ...args: Args
  ) => Promisable<T>

  export type HydrateFunction<
    Served = any,
    Hydrated = any,
    Args extends readonly any[] = any
  > = (
    this: void,
    state: Served,
    entry: StateModule.CacheEntry<Served, Args>
  ) => Hydrated

  export type LoadListener = { dispose: () => void }
  export type LoadCallback<T = any, Args extends readonly any[] = any> = (
    args: Args,
    state: T,
    expiresAt?: Cache.MaxAge
  ) => void

  export type CacheEntry<
    State = any,
    Args extends readonly any[] = any
  > = Cache.Entry<State, Args> & {
    args: Args
  }
}
