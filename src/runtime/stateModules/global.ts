import { getStackFrame } from '@utils/node/stack/getStackFrame'
import { stateModulesByName } from '../cache'
import type { StateModule } from '../stateModules'

export const stateModulesByFile = new Map<string, Map<string, StateModule>>()

export function trackStateModule(module: StateModule) {
  // Skip this function and the `defineStateModule` function.
  const caller = getStackFrame(2)
  if (caller) {
    const modules = stateModulesByFile.get(caller.file) || new Map()
    stateModulesByFile.set(caller.file, modules)
    modules.set(module.name, module)
  }
  stateModulesByName.set(module.name, module)
}
