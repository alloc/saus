// Overrides "src/core/loadStateModule.ts" module in client builds
import { stateModuleBase } from '../runtime/constants'
import { getCachedState } from '../runtime/getCachedState'
import { prependBase } from './prependBase'

export function loadStateModule(
  id: string,
  args: any[],
  loadImpl: undefined,
  toCacheKey: (args: any[]) => string
) {
  const cacheKey = toCacheKey(args)
  return getCachedState(cacheKey, async () => {
    const stateUrl = prependBase(stateModuleBase + cacheKey + '.js')
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
