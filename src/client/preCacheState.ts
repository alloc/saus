import saus from './context'
import { prependBase } from './prependBase'

/**
 * Note: This doesn't support on-demand state modules, so it should
 * only be used for state modules coupled to the page's route, which
 * means the state module is loaded unconditionally when the page
 * is requested.
 */
export function preCacheState(...cacheKeys: string[]) {
  return Promise.all(
    cacheKeys.map(cacheKey => {
      const stateUrl = prependBase(saus.stateModuleBase + cacheKey + '.js')
      return import(/* @vite-ignore */ stateUrl)
    })
  )
}
