import { TimeToLive } from '../runtime/ttl'
import { debug } from './debug'

type Caches = typeof import('../runtime/cache')
type StateLoader<State = any> = () => Promise<State>

export function withCache<State = any>(
  caches: Caches,
  getDefaultLoader: (cacheKey: string) => StateLoader<State>
): (cacheKey: string, loader?: StateLoader<State>) => Promise<State>

export function withCache<State = any>(
  caches: Caches,
  getDefaultLoader?: (cacheKey: string) => StateLoader<State> | undefined
): {
  (cacheKey: string): Promise<State | undefined>
  (cacheKey: string, loader: StateLoader<State>): Promise<State>
}

export function withCache(
  { loadedStateCache, loadingStateCache }: Caches,
  getDefaultLoader: (cacheKey: string) => StateLoader | undefined = () =>
    undefined
) {
  return function getCachedState(cacheKey: string, loader?: StateLoader) {
    if (loadedStateCache.has(cacheKey)) {
      const useCachedValue =
        TimeToLive.isAlive(cacheKey) ||
        // Use expired state if no loader is given.
        !(loader ||= getDefaultLoader(cacheKey))

      if (useCachedValue) {
        return Promise.resolve(loadedStateCache.get(cacheKey))
      }
    }
    let loadingState = loadingStateCache.get(cacheKey)
    if (!loadingState && (loader ||= getDefaultLoader(cacheKey))) {
      const time = Date.now()
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
            } else {
              debug('State %s expired while loading, skipping cache', cacheKey)
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
