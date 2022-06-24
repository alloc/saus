import { getStackFrame, StackFrame } from '../node/stack'
import { formatAsyncStack } from './formatAsyncStack'
import { ModuleMap } from './types'

export function traceNodeRequire(
  moduleMap: ModuleMap,
  asyncStack: (StackFrame | undefined)[],
  skippedFile: string,
  filterStack?: (file: string) => boolean
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
      formatAsyncStack(error, moduleMap, asyncStack, filterStack)
      throw error
    }
  }
  return () => {
    requireHooks['.js'] = evaluate
  }
}
