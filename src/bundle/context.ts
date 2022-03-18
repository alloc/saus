import type { MutableRuntimeConfig } from '../core/config'
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

/**
 * Update the bundle's runtime config.
 */
export const configureBundle = (update: Partial<MutableRuntimeConfig>): void =>
  void Object.assign(config, update)
