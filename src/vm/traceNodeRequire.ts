import { getStackFrame, StackFrame } from '../utils/resolveStackTrace'
import { formatAsyncStack } from './formatAsyncStack'
import { ModuleMap } from './types'

export function traceNodeRequire(
  moduleMap: ModuleMap,
  asyncStack: (StackFrame | undefined)[],
  skippedFile: string
) {
  const requireHooks = require.extensions
  const evaluate = requireHooks['.js']
  requireHooks['.js'] = (module, filename) => {
    const isNestedRequire = skippedFile !== filename
    if (isNestedRequire) {
      asyncStack = [getStackFrame(2), ...asyncStack]
    }
    try {
      evaluate(module, filename)
      if (isNestedRequire) {
        asyncStack = asyncStack.slice(1)
      }
    } catch (error: any) {
      formatAsyncStack(error, moduleMap, asyncStack)
      throw error
    }
  }
  return () => {
    requireHooks['.js'] = evaluate
  }
}
