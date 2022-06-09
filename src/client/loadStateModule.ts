// Overrides "src/core/loadStateModule.ts" module in client builds
import { getCachedState } from '../runtime/getCachedState'
import { getLoadedStateOrThrow } from '../runtime/getLoadedStateOrThrow'
import { prependBase } from './prependBase'

export function loadStateModule(
  id: string,
  args: any[],
  loadImpl: false | undefined,
  toCacheKey: (args: any[]) => string
) {
  const cacheKey = toCacheKey(args)

  // Only the `get` method passes a false loadImpl.
  if (loadImpl === false) {
    return getLoadedStateOrThrow(cacheKey, args)[0]
  }

  return getCachedState(cacheKey, async () => {
    const stateUrl = prependBase(saus.stateModuleBase + cacheKey + '.js')
    if (import.meta.env.DEV) {
      // Ensure this module is ready to serve.
      await fetch(stateUrl, {
        method: 'POST',
        body: JSON.stringify([id, args]),
      })
    }
    const stateModule = await import(/* @vite-ignore */ stateUrl)
    return stateModule.default
  })
}
