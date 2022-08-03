// Overrides "src/core/loadStateModule.ts" module in client builds
import { globalCache } from '@/runtime/cache'
import { getCachedState } from '@/runtime/getCachedState'
import { getLoadedStateOrThrow } from '@/runtime/getLoadedStateOrThrow'
import { prependBase } from './prependBase'
import { notifyStateListeners } from './stateListeners'

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

  return getCachedState(cacheKey, async cacheControl => {
    const stateUrl = prependBase(saus.stateModuleBase + cacheKey + '.js')
    if (import.meta.env.DEV) {
      // Ensure this module is ready to serve.
      await fetch(stateUrl, {
        method: 'POST',
        body: JSON.stringify([id, args]),
      })
    }
    await import(/* @vite-ignore */ stateUrl)
    const [state, expiresAt] = globalCache.loaded[cacheKey]
    if (expiresAt !== undefined) {
      cacheControl.maxAge = (expiresAt - Date.now()) / 1e3
    }
    notifyStateListeners(cacheKey, args, state, expiresAt)
    return state
  })
}
