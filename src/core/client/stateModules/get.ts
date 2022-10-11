import { Cache } from '@/runtime/cache'
import { getLoadedStateOrThrow } from '@/runtime/getLoadedStateOrThrow'
import { getStateModuleKey } from '@/runtime/getStateModuleKey'
import type { StateModule } from '@/runtime/stateModules'

export function getState<T, Args extends readonly any[]>(
  cache: Cache,
  module: StateModule<T, Args>,
  args: Args
) {
  const key = getStateModuleKey(module, args)
  return getLoadedStateOrThrow(cache, key, args)
}
