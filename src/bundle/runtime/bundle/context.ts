import type { App } from '@/app/types'
import type { MutableRuntimeConfig } from '@/runtime/config'
import { ssrImport } from '@/runtime/ssrModules'
import { withCache } from '@/runtime/withCache'
import config from './config'

export const context: App.Context = {
  config,
  defaultState: [],
  getCachedPage: withCache({
    loading: {},
    loaders: {},
    loaded: {},
  }),
  onError: console.error,
  routes: [],
  runtimeHooks: [],
  ssrRequire: ssrImport,
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
