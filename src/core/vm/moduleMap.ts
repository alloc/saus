import { noop } from '@/utils/noop'
import { getNodeModule, unloadNodeModule } from './nodeModules'
import { CompiledModule, isLinkedModule, LinkedModule } from './types'

const moduleMaps = new WeakMap<CompiledModule, ModuleMap>()

export class ModuleMap extends Map<string, CompiledModule> {
  promises = new Map<string, Promise<CompiledModule | null>>()
  setPromise(moduleId: string, promise: Promise<CompiledModule | null>) {
    this.promises.set(moduleId, promise)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    promise.catch(noop).then(module => {
      if (promise == this.promises.get(moduleId)) {
        this.promises.delete(moduleId)
        if (module) {
          this.set(moduleId, module)
          moduleMaps.set(module, this)
        }
      }
    })
    return promise
  }
}

export interface PurgeContext<T extends CompiledModule | LinkedModule> {
  touched: Set<string>
  accept: (
    module: CompiledModule,
    dep?: CompiledModule | LinkedModule
  ) => boolean
  onPurge: PurgeHandler<T>
}

export type PurgeHandler<
  T extends CompiledModule | LinkedModule = CompiledModule | LinkedModule
> = (module: T, isAccepted: boolean, stopPropagation: () => void) => void

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

    let propagationStopped = false
    const isAccepted = context.accept(module)
    context.onPurge(module, isAccepted, () => {
      propagationStopped = true
    })

    if (!propagationStopped)
      for (const importer of module.importers) {
        unloadModuleAndImporters(importer, context, isAccepted, module)
      }

    const moduleMap = moduleMaps.get(module)
    if (moduleMap) {
      moduleMaps.delete(module)
      moduleMap.delete(module.id)
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
    if (!isAccepted) {
      isAccepted = !isLinkedModule(module) && context.accept(module, dep)
    }

    let propagationStopped = false
    context.onPurge(module, isAccepted, () => {
      propagationStopped = true
    })

    if (!propagationStopped)
      for (const importer of module.importers) {
        unloadModuleAndImporters(importer, context, isAccepted, module)
      }

    if (isLinkedModule(module)) {
      const nodeModule = getNodeModule(module.id)
      if (nodeModule && nodeModule.reload !== false) {
        unloadNodeModule(module.id)
      }
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
