import { preHydrateCache, stateModulesByName } from '@runtime/cache'
import type { StateModule } from '@runtime/stateModules'
import { hydrateState } from './hydrate'

export function trackStateModule(module: StateModule) {
  // TODO: escape moduleIds for regex syntax
  const cacheKeyPattern = new RegExp('^(' + module.name + ')(\\.[^.]+)?$')
  for (const [key, served] of preHydrateCache) {
    if (cacheKeyPattern.test(key)) {
      hydrateState(key, served, module)
      preHydrateCache.delete(key)
    }
  }
  stateModulesByName.set(module.name, module)
}
