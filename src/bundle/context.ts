import { withCache } from '../core/withCache'
import type { PageFactoryContext } from '../pages/types'
import config from './config'

interface RuntimeContext extends PageFactoryContext {
  debugBasePath: string
}

export const context: RuntimeContext = {
  defaultPath: config.defaultPath,
  defaultState: [],
  getCachedPage: withCache({
    loading: {},
    loaders: {},
    loaded: {},
  }),
  logger: {
    error: console.error,
  },
  // Lazy binding so "config.base" can be mutated.
  get basePath() {
    return config.base
  },
  // Enable "debug view" when this begins the URL pathname.
  get debugBasePath() {
    return config.debugBase ? config.base.replace(/\/$/, config.debugBase) : ''
  },
  beforeRenderHooks: [],
  runtimeHooks: [],
  renderers: [],
  routes: [],
}
