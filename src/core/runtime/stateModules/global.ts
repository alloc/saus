import { getStackFrame } from '@/node/stack'
import type { StateModule } from '../stateModules'

export const stateModulesById = new Map<string, StateModule>()
export const stateModulesByFile = new Map<string, StateModule[]>()

export function trackStateModule(module: StateModule) {
  const caller = getStackFrame(3)
  if (caller) {
    const modules = stateModulesByFile.get(caller.file) || []
    stateModulesByFile.set(caller.file, modules)
    modules.push(module)
  }
  stateModulesById.set(module.id, module)
}
