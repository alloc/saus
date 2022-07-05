import { Merge } from 'type-fest'
import { CompiledModule, isLinkedModule, LinkedModule } from './types'

/**
 * Live modules must have a `module.exports` value that's a plain object
 * and its exports must not be destructured by importers.
 */
export function isLiveModule(
  module: CompiledModule | LinkedModule,
  liveModulePaths: Set<string>
): module is Merge<LinkedModule, { exports: Record<string, any> }> {
  return (
    isLinkedModule(module) &&
    module.exports?.constructor == Object &&
    liveModulePaths.has(module.id)
  )
}
