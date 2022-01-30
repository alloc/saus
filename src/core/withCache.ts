import createDebug from 'debug'
import { TimeToLive } from './ttl'

const debug = createDebug('saus:cache')

type StateLoader<State = any> = () => Promise<State>

export function withCache<State = any>(
  loadingStateCache: Map<string, Promise<any>>,
  loadedStateCache: Map<string, any>,
  getDefaultLoader: (cacheKey: string) => StateLoader<State>
): (cacheKey: string, loader?: StateLoader<State>) => Promise<State>

export function withCache<State = any>(
  loadingStateCache: Map<string, Promise<any>>,
  loadedStateCache: Map<string, any>,
  getDefaultLoader?: (cacheKey: string) => StateLoader<State> | undefined
): {
  (cacheKey: string): Promise<State | undefined>
  (cacheKey: string, loader: StateLoader<State>): Promise<State>
}

export function withCache(
  loadingStateCache: Map<string, Promise<any>>,
  loadedStateCache: Map<string, any>,
  getDefaultLoader: (cacheKey: string) => StateLoader | undefined = () =>
    undefined
) {
  return function getCachedState(cacheKey: string, loader?: StateLoader) {
    if (loadedStateCache.has(cacheKey) && TimeToLive.isAlive(cacheKey)) {
      return Promise.resolve(loadedStateCache.get(cacheKey))
    }
    let loadingState = loadingStateCache.get(cacheKey)
    if (!loadingState && (loader ||= getDefaultLoader(cacheKey))) {
      debug(`Loading "%s" state`, cacheKey)
      loadingStateCache.set(
        cacheKey,
        (loadingState = loader().then(
          loadedState => {
            // If the promise is deleted before it resolves,
            // assume the user does not want the state cached.
            if (!loadingStateCache.delete(cacheKey)) {
              return loadedState
            }
            // TTL may have been set to 0.
            if (TimeToLive.isAlive(cacheKey)) {
              loadedStateCache.set(cacheKey, loadedState)
            }
            return loadedState
          },
          error => {
            loadingStateCache.delete(cacheKey)
            throw error
          }
        ))
      )
    }
    return loadingState
  }
}
