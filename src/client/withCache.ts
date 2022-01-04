export function withCache<State>(
  loadingStateCache: Map<string, Promise<any>>,
  loadedStateCache: Map<string, any>,
  getDefaultLoader: (cacheKey: string) => (() => Promise<any>) | undefined
) {
  return function getOrLoadState(
    cacheKey: string,
    loader = getDefaultLoader(cacheKey)
  ): Promise<any> {
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
