import { noop } from '../utils/noop'
import { debug } from './debug'
import { ImporterSet } from './ImporterSet'
import { CompiledModule, ModuleMap } from './types'

const moduleMaps = new WeakMap<CompiledModule, ModuleMap>()

export function registerModule(module: CompiledModule, moduleMap: ModuleMap) {
  if (moduleMaps.has(module)) {
    throw Error('Module is already registered')
  }
  moduleMaps.set(module, moduleMap)
  moduleMap[module.id] = module
}

export function registerModuleOnceCompiled(
  moduleMap: ModuleMap,
  modulePromise: Promise<CompiledModule>
) {
  const compileQueue = moduleMap.__compileQueue
  if (!compileQueue) {
    Object.defineProperty(moduleMap, '__compileQueue', {
      value: undefined,
      writable: true,
    })
  }

  moduleMap.__compileQueue = modulePromise
    .then(module => {
      registerModule(module, moduleMap)
      return compileQueue
    })
    .catch(noop)

  return modulePromise
}

/**
 * Remove the given module from its module map, then invalidate any modules
 * that depend on it (directly or through another module). All affected modules
 * are re-executed, but only the given module is re-compiled.
 */
export function purgeModule(
  module: CompiledModule,
  visited = new Set<string>(),
  onPurge?: (module: CompiledModule) => void
) {
  if (!visited.has(module.id)) {
    visited.add(module.id)
    debug('purge module: %O', module.id)
    onPurge?.(module)
    disconnectModule(module, importer => {
      purgeModuleExports(importer, visited, onPurge)
    })
    const moduleMap = moduleMaps.get(module)
    if (moduleMap) {
      moduleMaps.delete(module)
      delete moduleMap[module.id]
    }
  }
}

export function purgeModuleExports(
  module: CompiledModule,
  visited: Set<string>,
  onPurge?: (module: CompiledModule) => void
) {
  if (!visited.has(module.id)) {
    visited.add(module.id)
    debug('purge exports: %O', module.id)
    onPurge?.(module)
    disconnectModule(module, importer => {
      purgeModuleExports(importer, visited, onPurge)
    })
    module.exports = undefined
    module.package = undefined
    module.imports.clear()
    module.importers = new ImporterSet()
  }
}

function disconnectModule(
  module: CompiledModule,
  onImporter: (module: CompiledModule) => void
) {
  module.package?.delete(module)
  module.importers.forEach(onImporter)
  for (const imported of module.imports) {
    imported.importers.delete(module)
  }
}
