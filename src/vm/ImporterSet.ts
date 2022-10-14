import { CompiledModule } from './types'

export class ImporterSet extends Set<CompiledModule> {
  private _dynamics?: Set<CompiledModule>

  add(importer: CompiledModule, isDynamic?: boolean) {
    if (isDynamic) {
      this._dynamics ||= new Set()
      this._dynamics.add(importer)
    } else {
      super.add(importer)
    }
    return this
  }

  delete(importer: CompiledModule) {
    const wasStaticImporter = super.delete(importer)
    const wasDynamicImporter = !!this._dynamics?.delete(importer)
    return wasStaticImporter || wasDynamicImporter
  }

  hasDynamic(importer: CompiledModule) {
    return !!this._dynamics?.has(importer)
  }
}
