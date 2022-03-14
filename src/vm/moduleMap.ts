import { noop } from '../utils/noop'
import {
  CompiledModule,
  isLinkedModule,
  kLinkedModule,
  LinkedModule,
  ModuleMap,
} from './types'

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
  onModule?: (module: CompiledModule) => void
) {
  if (!visited.has(module.id)) {
    visited.add(module.id)
    onModule?.(module)
    for (const importer of module.importers) {
      resetModuleAndImporters(importer, visited, onModule)
    }
    const moduleMap = moduleMaps.get(module)
    if (moduleMap) {
      moduleMaps.delete(module)
      delete moduleMap[module.id]
    }
  }
}

export function resetModuleAndImporters(
  module: CompiledModule | LinkedModule,
  visited?: Set<string>,
  onModule?: (module: CompiledModule | LinkedModule) => void
): void

export function resetModuleAndImporters(
  module: CompiledModule,
  visited?: Set<string>,
  onModule?: (module: CompiledModule) => void
): void

/**
 * Reset the given module and its importers.
 */
export function resetModuleAndImporters(
  module: CompiledModule | LinkedModule,
  visited = new Set<string>(),
  onModule?: Function
) {
  if (!visited.has(module.id)) {
    visited.add(module.id)
    onModule?.(module)
    for (const importer of module.importers) {
      resetModuleAndImporters(importer, visited, onModule as any)
    }
    if (isLinkedModule(module)) {
      delete require.cache[module.id]
    } else {
      resetExports(module)
    }
    resetImports(module)
  }
}

export function resetImports(module: CompiledModule | LinkedModule) {
  for (const imported of module.imports) {
    imported.importers.delete(module as any)
  }
  module.imports.clear()
}

export function resetExports(module: CompiledModule) {
  module.exports = undefined
  module.package?.delete(module)
  module.package = undefined
}
