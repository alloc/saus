import type { ClientState } from '../core'
import { withCache } from '../core/withCache'
import * as globalCache from '../runtime/cache'
import { getPageFilename } from '../utils/getPageFilename'
import { unwrapDefault } from '../utils/unwrapDefault'

export { clearState as clearClientState } from '../runtime/clearState'
export type { ClientState }

/**
 * Load client state for the given URL, using the local cache if possible.
 *
 * The `pageUrl` argument must not contain either a hash fragment (eg: `#foo`)
 * or a search query (eg: `?foo`).
 */
export const loadClientState = withCache(globalCache, pageUrl => {
  if (pageUrl[0] == '/') {
    const stateUrl =
      '/' + getPageFilename(pageUrl, import.meta.env.BASE_URL) + '.js'

    return async () => unwrapDefault(await import(/* @vite-ignore */ stateUrl))
  }
}) as {
  (pageUrl: string): Promise<ClientState>
  <T>(cacheKey: string, loader: () => Promise<T>): Promise<T>
}
