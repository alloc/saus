import { loadClientState } from './state'

export const loadStateModule = (
  cacheKey: string,
  loadImpl: undefined,
  ...args: any[]
) =>
  loadClientState(cacheKey, async () => {
    const imported = await import(/* @vite-ignore */ `/${cacheKey}.js`)
    return imported.default
  })
