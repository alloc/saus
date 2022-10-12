import { klona as deepCopy } from '@/utils/klona'
import { Cache } from '../cache'
import type { StateModule } from '../stateModules'

/**
 * Hydrate the data served for an instance of the given state module.
 *
 * In a client context, this function also mutates the global cache and
 * calls any relevant cache listeners.
 */
export function hydrateState(
  key: string,
  served: Cache.Entry,
  module: StateModule,
  opts: { deepCopy?: boolean } = {}
) {
  const [state, expiresAt, args] = served
  const hydrate = module['_hydrate']
  return hydrate
    ? hydrate(args, opts.deepCopy ? deepCopy(state) : state, expiresAt)
    : state
}

export function hydrateStateListener(id: string, listener: Cache.Listener) {
  // Do nothing in a server context.
}
