import type { AppContext } from '@/app/types'
import type { MutableRuntimeConfig } from '@/runtime/config'
import { withCache } from '@/runtime/withCache'
import config from './config'
import functions from './functions'
import moduleMap from './moduleMap'

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
  helpersId: moduleMap.helpers,
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
