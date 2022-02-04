// Overrides "src/core/loadStateModule.ts" module in client builds
import { getCachedState } from '../runtime/getCachedState'

export const loadStateModule = (
  cacheKey: string,
  loadImpl: undefined,
  ...args: any[]
) =>
  getCachedState(cacheKey, async () => {
    const imported = await import(/* @vite-ignore */ `/${cacheKey}.js`)
    return imported.default
  })
