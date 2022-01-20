import type { ClientState, StateModule } from '../core'
import { withCache } from '../core/withCache'
import { getPageFilename } from '../utils/getPageFilename'
import { unwrapDefault } from '../utils/unwrapDefault'
import { loadedStateCache, loadingStateCache } from './cache'

export type { ClientState, StateModule }

/**
 * Load client state for the given URL, using the local cache if possible.
 *
 * The `pageUrl` argument must not contain either a hash fragment (eg: `#foo`)
 * or a search query (eg: `?foo`).
 */
export const loadClientState: {
  (pageUrl: string): Promise<ClientState>
  /**
   * Use the same cache that Saus keeps page-specific state in.
   */
  <T>(cacheKey: string, loader: () => Promise<T>): Promise<T>
} = withCache(loadingStateCache, loadedStateCache, pageUrl => {
  if (pageUrl[0] == '/') {
    const stateUrl =
      '/' + getPageFilename(pageUrl, import.meta.env.BASE_URL) + '.js'

    return async () => unwrapDefault(await import(/* @vite-ignore */ stateUrl))
  }
})
