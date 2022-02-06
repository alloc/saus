import { CompiledModule } from './types'

export class ImporterSet extends Set<CompiledModule> {
  private _dynamics?: Set<CompiledModule>

  add(module: CompiledModule, isDynamic?: boolean) {
    if (isDynamic) {
      this._dynamics ||= new Set()
      this._dynamics.add(module)
    } else {
      super.add(module)
    }
    return this
  }

  hasDynamic(module: CompiledModule) {
    return !!this._dynamics?.has(module)
  }
}
