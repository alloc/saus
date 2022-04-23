import type { AppContext } from '../app/types'
import type { MutableRuntimeConfig } from '../core/config'
import { withCache } from '../core/withCache'
import config from './config'
import functions from './functions'
import { ssrImport } from './ssrModules'

export const context: AppContext = {
  beforeRenderHooks: [],
  config,
  defaultState: [],
  functions,
  getCachedPage: withCache({
    loading: {},
    loaders: {},
    loaded: {},
  }),
  onError: console.error,
  renderers: [],
  routes: [],
  runtimeHooks: [],
  ssrRequire(id, _importer, isDynamic) {
    return ssrImport(id, !isDynamic)
  },
}

/**
 * Update the bundle's runtime config.
 */
export function configureBundle(update: Partial<MutableRuntimeConfig>): void {
  if ('profile' in update) {
    context.profile = update.profile
    delete update.profile
  }
  Object.assign(config, update)
}
