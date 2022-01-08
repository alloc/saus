import type { ClientState, StateModule } from '../core'
import { loadedStateCache, loadingStateCache } from './cache'
import { withCache } from './withCache'

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
  if (pageUrl[0] == '/' && typeof fetch !== 'undefined') {
    const stateUrl = pageUrl.replace(/\/?$/, '/state.json')

    return async () => {
      const resp = await fetch(stateUrl)

      type ResolvedStateModule = [Record<string, any>, string, any]
      const pendingStateModules: Promise<ResolvedStateModule>[] = []

      const state = JSON.parse(await resp.text(), function (key, value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return value
        }
        // Embedded state modules must be dynamically imported.
        const url = value['@import']
        if (typeof url == 'string' && Object.keys(value).length == 1) {
          pendingStateModules.push(
            import(url).then(value => [this, key, value])
          )
          return null
        }
        return value
      })

      if (pendingStateModules.length) {
        const resolvedStateModules = await Promise.all(pendingStateModules)
        for (const [parent, key, value] of resolvedStateModules) {
          parent[key] = value
        }
      }

      return state
    }
  }
})
