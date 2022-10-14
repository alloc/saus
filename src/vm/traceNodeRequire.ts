import { getStackFrame, StackFrame } from '../node/stack'
import { formatAsyncStack } from './formatAsyncStack'
import { ModuleMap } from './moduleMap'

export function traceNodeRequire(
  moduleMap: ModuleMap,
  requireStack: (StackFrame | undefined)[],
  skippedFile: string,
  filterStack?: (file: string) => boolean
) {
  const requireHooks = require.extensions
  const evaluate = requireHooks['.js']
  requireHooks['.js'] = (module, filename) => {
    const isNestedRequire = skippedFile !== filename
    if (isNestedRequire) {
      // Add the caller of this require hook.
      requireStack = [getStackFrame(1), ...requireStack]
    }
    try {
      evaluate(module, filename)
      if (isNestedRequire) {
        requireStack = requireStack.slice(1)
      }
    } catch (error: any) {
      formatAsyncStack(error, moduleMap, requireStack, filterStack)
      throw error
    }
  }
  return () => {
    requireHooks['.js'] = evaluate
  }
}
