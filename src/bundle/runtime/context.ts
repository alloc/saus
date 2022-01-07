import type { PageFactoryContext } from '../../pages'
import config from './config'

export const context: PageFactoryContext = {
  pages: {},
  defaultState: [],
  loadingStateCache: new Map(),
  loadedStateCache: new Map(),
  logger: { warn: console.warn },
  basePath: config.base,
  beforeRenderHooks: [],
  runtimeHooks: [],
  renderers: [],
  routes: [],
}

// This module is used in place of "saus/src/client/cache"
// so we need to export the cache maps.
export const loadingStateCache = context.loadingStateCache
export const loadedStateCache = context.loadedStateCache
