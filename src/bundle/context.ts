import { withCache } from '../core/withCache'
import type { PageFactoryContext } from '../pages/types'
import config from './config'

export const context: PageFactoryContext = {
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
  basePath: config.base,
  beforeRenderHooks: [],
  runtimeHooks: [],
  renderers: [],
  routes: [],
}
