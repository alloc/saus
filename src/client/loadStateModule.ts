// Overrides "src/core/loadStateModule.ts" module in client builds
import { getCachedState } from '../runtime/getCachedState'

export function loadStateModule(
  id: string,
  args: any[],
  loadImpl: undefined,
  toCacheKey: (args: any[]) => string
) {
  const cacheKey = toCacheKey(args)
  return getCachedState(cacheKey, async () => {
    if (import.meta.env.DEV) {
      // Ensure this module is ready to serve.
      await fetch(import.meta.env.BASE_URL + `state/${cacheKey}.js`, {
        method: 'POST',
        body: JSON.stringify([id, args]),
      })
    }
    const stateUrl = import.meta.env.BASE_URL + `state/${cacheKey}.js`
    const stateModule = await import(/* @vite-ignore */ stateUrl)
    return stateModule.default
  })
}
