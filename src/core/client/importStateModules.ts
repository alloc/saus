import { prependBase } from '@/client/prependBase'
import { globalCache } from '@/runtime/cache'
import saus from './context'

/**
 * Note: This doesn't support on-demand state modules, so it should
 * only be used for state modules coupled to the page's route, which
 * means the state module is loaded unconditionally when the page
 * is requested.
 */
export function importStateModules(...args: any[]) {
  return Promise.all(
    args.map(async cacheKey => {
      const [state] = await globalCache.access(cacheKey, async () => {
        const stateUrl = prependBase(saus.stateModuleBase + cacheKey + '.js')
        await import(/* @vite-ignore */ stateUrl)

        // Skip updating the cache and use the cache entry that was
        // injected by the module we just imported.
        return Symbol.for('skip')
      })
      return state
    })
  )
}
