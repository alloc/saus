import builtinModules from 'builtin-modules'
import fs from 'fs'
import { Module } from 'module'
import { noop } from '../utils/noop'
import { relativeToCwd } from '../utils/relativeToCwd'
import { getStackFrame, StackFrame } from '../utils/resolveStackTrace'
import { exportsId } from './compileEsm'
import { debug } from './debug'
import { executeModule } from './executeModule'
import { formatAsyncStack, traceDynamicImport } from './formatAsyncStack'
import { traceNodeRequire } from './traceNodeRequire'
import {
  CompiledModule,
  CompileModuleHook,
  ModuleMap,
  RequireAsync,
  ResolveIdHook,
} from './types'

export type RequireAsyncConfig = {
  moduleMap: ModuleMap
  resolveId: ResolveIdHook
  isCompiledModule: (id: string) => boolean
  compileModule: CompileModuleHook
  filterStack?: (file: string) => boolean
}

const nodeRequire = Module.createRequire(__filename)

export function createAsyncRequire({
  moduleMap,
  resolveId,
  isCompiledModule,
  compileModule,
  filterStack,
}: RequireAsyncConfig): RequireAsync {
  let callStack: (StackFrame | undefined)[] = []

  return async function requireAsync(id, importer, isDynamic) {
    if (builtinModules.includes(id)) {
      return nodeRequire(id)
    }

    const time = Date.now()
    const asyncStack = isDynamic
      ? traceDynamicImport(Error())
      : (callStack = [getStackFrame(3), ...callStack])

    let resolvedId: string | undefined
    try {
      resolvedId = await resolveId(id, importer, isDynamic)
    } catch (error: any) {
      formatAsyncStack(error, moduleMap, asyncStack, filterStack)
      throw error
    }

    const isVirtual = !!(
      id.startsWith('virtual:') ||
      (resolvedId && (resolvedId[0] === '\0' || id === resolvedId))
    )

    let isCached = true
    let exports: any
    let module: CompiledModule | undefined

    if (resolvedId && (isVirtual || isCompiledModule(resolvedId))) {
      await moduleMap.__compileQueue
      if ((isCached = resolvedId in moduleMap)) {
        module = moduleMap[resolvedId]
        const circularIndex = asyncStack.findIndex(
          frame => frame?.file == resolvedId
        )
        if (circularIndex >= 0) {
          exports = module.env[exportsId]
          if (process.env.DEBUG) {
            const importLoop = asyncStack
              .slice(0, circularIndex + 1)
              .filter(Boolean)
              .map(frame => (frame as StackFrame).file)
              .reverse()
              .concat(resolvedId)

            debug(
              `Circular import may lead to unexpected behavior\n `,
              importLoop.map(relativeToCwd).join(' → ')
            )
          }
        } else {
          exports = module.exports
        }
      } else {
        const modulePromise = compileModule(resolvedId, requireAsync).then(
          module => {
            if (!module) {
              const error = Object.assign(
                Error(`Cannot find module '${resolvedId}'`),
                { code: 'ERR_MODULE_NOT_FOUND' }
              )
              formatAsyncStack(error, moduleMap, asyncStack, filterStack)
              throw error
            }
            return module
          }
        )
        updateModuleMap(moduleMap, modulePromise)
        module = await modulePromise
        try {
          exports = await executeModule(module)
        } catch (error: any) {
          formatAsyncStack(error, moduleMap, asyncStack, filterStack)
          throw error
        }
      }
    } else {
      try {
        resolvedId = nodeRequire.resolve(id, {
          paths: [importer],
        })
      } catch (error: any) {
        // Fall back to the Vite resolution if Node resolution fails.
        if (!resolvedId || !fs.existsSync(resolvedId)) {
          formatAsyncStack(error, moduleMap, asyncStack, filterStack)
          throw error
        }
      }
      const cached = nodeRequire.cache[resolvedId]
      if ((isCached = !!cached)) {
        exports = cached.exports
      } else {
        const unhook = traceNodeRequire(
          moduleMap,
          asyncStack,
          resolvedId,
          filterStack
        )
        try {
          exports = nodeRequire(resolvedId)
        } finally {
          unhook()
        }
      }
    }

    if (!isDynamic) {
      module?.importers.add(moduleMap[importer])
      callStack = callStack.slice(1)
    }

    if (!isCached) {
      debug(`Loaded "${resolvedId}" in ${Date.now() - time}ms`)
    }

    return exports
  }
}

export function updateModuleMap(
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
      moduleMap[module.id] = module
      return compileQueue
    })
    .catch(noop)
}

export function injectNodeModule(filename: string, exports: any) {
  nodeRequire.cache[filename] = Object.assign(new Module(filename), {
    filename,
    exports,
    loaded: true,
  })
}
