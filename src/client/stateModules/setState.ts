import type { Cache } from '@runtime/cache'
import { globalCache, stateModulesByName } from '@runtime/cache'
import { getStateModuleKey } from '@runtime/getStateModuleKey'
import { serveCache } from '@runtime/stateModules/serve'
import { hydrateState, preHydrateCache } from './hydrate'

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
  const served = (serveCache.loaded[key] = { state, args, timestamp, maxAge })

  // Page state is never hydrated.
  if (name[0] === '/') {
    globalCache.loaded[key] = served
  } else {
    const module = stateModulesByName.get(name)
    if (module) {
      hydrateState(key, served, module)
    } else {
      preHydrateCache.set(key, served)
    }
  }

  return state
}
