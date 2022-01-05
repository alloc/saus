export function withCache<State = any>(
  loadingStateCache: Map<string, Promise<any>>,
  loadedStateCache: Map<string, any>,
  getDefaultLoader: (cacheKey: string) => () => Promise<State>
): (cacheKey: string, loader?: () => Promise<State>) => Promise<State>

export function withCache<State = any>(
  loadingStateCache: Map<string, Promise<any>>,
  loadedStateCache: Map<string, any>,
  getDefaultLoader?: (cacheKey: string) => (() => Promise<State>) | undefined
): {
  (cacheKey: string): Promise<State | undefined>
  (cacheKey: string, loader: () => Promise<State>): Promise<State>
}

export function withCache(
  loadingStateCache: Map<string, Promise<any>>,
  loadedStateCache: Map<string, any>,
  getDefaultLoader: (
    cacheKey: string
  ) => (() => Promise<any>) | undefined = () => undefined
) {
  return (cacheKey: string, loader = getDefaultLoader(cacheKey)) => {
    if (!loader) {
      return Promise.resolve()
    }
    if (loadedStateCache.has(cacheKey)) {
      return Promise.resolve(loadedStateCache.get(cacheKey))
    }
    let loadingState = loadingStateCache.get(cacheKey)
    if (!loadingState) {
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
