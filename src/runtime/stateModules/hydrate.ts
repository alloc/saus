import { klona as deepCopy } from '@utils/klona'
import type { Cache } from '../cache/types'
import type { StateModule } from '../stateModules'

/**
 * Hydrate the data served for an instance of the given state module.
 *
 * In a client context, this function also mutates the global cache and
 * calls any relevant cache listeners.
 */
export function hydrateState(
  key: string,
  served: StateModule.CacheEntry,
  module: StateModule,
  opts: { deepCopy?: boolean } = {}
) {
  const hydrate = module['_hydrate']
  if (hydrate) {
    const hydratedState = opts.deepCopy ? deepCopy(served.state) : served.state
    return hydrate(hydratedState, served)
  }
  return served.state
}

export function hydrateStateListener(id: string, listener: Cache.Listener) {
  // Do nothing in a server context.
}
