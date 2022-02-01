import type { PageFactoryContext } from '../pages/types'
import { getCachedState } from '../runtime/getCachedState'
import config from './config'

export const context: PageFactoryContext = {
  defaultPath: config.defaultPath,
  defaultState: [],
  getCachedPage: getCachedState,
  logger: {
    error: console.error,
  },
  basePath: config.base,
  beforeRenderHooks: [],
  runtimeHooks: [],
  renderers: [],
  routes: [],
}
