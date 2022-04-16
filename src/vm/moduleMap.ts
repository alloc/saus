import { noop } from '../utils/noop'
import { invalidateNodeModule } from './nodeModules'
import {
  CompiledModule,
  isLinkedModule,
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

export interface PurgeContext<T extends CompiledModule | LinkedModule> {
  touched: Set<string>
  accept: (
    module: CompiledModule,
    dep?: CompiledModule | LinkedModule
  ) => boolean
  onPurge: (module: T, isAccepted: boolean) => void
}

/**
 * Remove the given module from its module map, then invalidate any modules
 * that depend on it (directly or through another module). All affected modules
 * are re-executed, but only the given module is re-compiled.
 */
export function purgeModule(
  module: CompiledModule,
  context: PurgeContext<CompiledModule>
) {
  const { touched } = context
  if (!touched.has(module.id)) {
    touched.add(module.id)
    const isAccepted = context.accept(module)
    context.onPurge(module, isAccepted)
    for (const importer of module.importers) {
      unloadModuleAndImporters(importer, context, isAccepted, module)
    }
    const moduleMap = moduleMaps.get(module)
    if (moduleMap) {
      moduleMaps.delete(module)
      delete moduleMap[module.id]
    }
  }
}

export function unloadModuleAndImporters(
  module: CompiledModule | LinkedModule,
  context: PurgeContext<CompiledModule | LinkedModule>,
  isAccepted?: boolean,
  dep?: CompiledModule | LinkedModule
): void

export function unloadModuleAndImporters(
  module: CompiledModule,
  context: PurgeContext<CompiledModule>,
  isAccepted?: boolean,
  dep?: CompiledModule | LinkedModule
): void

/**
 * Reset the given module and its importers.
 */
export function unloadModuleAndImporters(
  module: CompiledModule | LinkedModule,
  context: PurgeContext<any>,
  isAccepted?: boolean,
  dep?: CompiledModule | LinkedModule
) {
  const { touched } = context
  if (!touched.has(module.id)) {
    touched.add(module.id)
    isAccepted ||= !isLinkedModule(module) && context.accept(module, dep)
    context.onPurge(module, isAccepted)
    for (const importer of module.importers) {
      unloadModuleAndImporters(importer, context, isAccepted, module)
    }
    if (isLinkedModule(module)) {
      invalidateNodeModule(module.id)
    } else {
      clearExports(module)
    }
    clearImports(module)
  }
}

export function clearImports(module: CompiledModule | LinkedModule) {
  for (const imported of module.imports) {
    imported.importers.delete(module as any)
  }
  module.imports.clear()
}

export function clearExports(module: CompiledModule) {
  module.exports = undefined
  module.package?.delete(module)
  module.package = undefined
}

/**
 * Check if the given `module` is imported (either directly or indirectly)
 * by the given `importer` module.
 */
export function isImported(
  module: CompiledModule | LinkedModule,
  importer: CompiledModule,
  seen = new Set<CompiledModule | LinkedModule>()
) {
  if (seen.has(module)) return false
  seen.add(module)

  // Note: Dynamic imports are ignored here.
  for (const possibleMatch of module.importers) {
    if (possibleMatch == importer) {
      return true
    }
    if (isImported(possibleMatch, importer, seen)) {
      return true
    }
  }

  return false
}
