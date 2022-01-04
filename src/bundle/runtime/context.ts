import type { PageFactoryContext } from '../../pages'

export const context: PageFactoryContext = {
  pages: {},
  loadingStateCache: new Map(),
  loadedStateCache: new Map(),
  logger: { warn: console.warn },
  beforeRenderHooks: [],
  runtimeHooks: [],
  renderers: [],
  routes: [],
}

// This module is used in place of "saus/src/client/cache"
// so we need to export the cache maps.
export const loadingStateCache = context.loadingStateCache
export const loadedStateCache = context.loadedStateCache
