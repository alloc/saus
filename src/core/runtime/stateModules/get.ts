import { klona as deepCopy } from '@/utils/klona'
import { Cache } from '../cache'
import { getLoadedStateOrThrow } from '../getLoadedStateOrThrow'
import type { StateModule } from '../stateModules'

/**
 * Unwrap a state module with the given arguments. \
 * Throws an error when the state isn't already loaded.
 */
export function getState<T, Args extends readonly any[]>(
  cache: Cache,
  module: StateModule<T, Args, any>,
  args: Args
) {
  const cached = getLoadedStateOrThrow(cache, module.key, args)
  return deepCopy(cached) as Cache.Entry<T>
}
