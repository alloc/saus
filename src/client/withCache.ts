import createDebug from 'debug'

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
  return (cacheKey: string, loader?: StateLoader) => {
    if (loadedStateCache.has(cacheKey)) {
      return Promise.resolve(loadedStateCache.get(cacheKey))
    }
    let loadingState = loadingStateCache.get(cacheKey)
    if (!loadingState && (loader ||= getDefaultLoader(cacheKey))) {
      debug(`Loading "%s"`, cacheKey)
      loadingStateCache.set(
        cacheKey,
        (loadingState = loader()
          .then(loadedState => {
            loadedStateCache.set(cacheKey, loadedState)
            return loadedState
          })
          .finally(() => {
            loadingStateCache.delete(cacheKey)
          }))
      )
    }
    return loadingState
  }
}
