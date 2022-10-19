import { Cache, stateModulesByName } from '../cache'
import { getStateModuleKey } from '../getStateModuleKey'
import { hydrateState } from '../stateModules/hydrate'

/**
 * State modules must call this when loaded by the client.
 */
export function setState<Args extends readonly any[]>(
  name: string,
  args: Args,
  state: any,
  timestamp: number,
  maxAge?: Cache.MaxAge
): any {
  const key = getStateModuleKey(name, args)
  const served = { state, args, timestamp, maxAge }
  const module = stateModulesByName.get(name)
  if (module) {
    hydrateState(key, served, module)
  }
  return state
}
