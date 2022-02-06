import builtinModules from 'builtin-modules'
import fs from 'fs'
import { Module } from 'module'
import path from 'path'
import { noop } from '../utils/noop'
import { relativeToCwd } from '../utils/relativeToCwd'
import { getStackFrame, StackFrame } from '../utils/resolveStackTrace'
import { exportsId } from './compileEsm'
import { debug } from './debug'
import { hookNodeResolve, NodeResolveHook } from './hookNodeResolve'
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
import kleur from 'kleur'
import { forceNodeReload } from './forceNodeReload'
import { getNodeModule as getCachedModule } from './getNodeModule'

export type RequireAsyncConfig = {
  /**
   * Reuse compiled modules between `createAsyncRequire` calls,
   * and wield full control over them.
   */
  moduleMap?: ModuleMap
  /**
   * This function must return a string before `isCompiledModule`
   * can be called. If it doesn't, then Node's module resolution
   * is used instead.
   */
  resolveId?: ResolveIdHook
  /**
   * When true is returned, the module is cleared from the module map
   * and re-executed. Works for Node-based modules too.
   */
  shouldReload?: (id: string) => boolean
  /**
   * If undefined, then all modules resolved by `resolveId` are compiled,
   * but only if `compileModule` is defined.
   *
   * Virtual modules are always compiled.
   */
  isCompiledModule?: (id: string) => boolean
  /**
   * Prepare a module for execution. Returning `null` will trigger
   * an `ERR_MODULE_NOT_FOUND` error.
   */
  compileModule?: CompileModuleHook
  /**
   * Filter the stack trace to remove files you don't care about.
   */
  filterStack?: (file: string) => boolean
  /**
   * Intercept native `require` calls to customize Node's module resolution.
   */
  nodeResolve?: NodeResolveHook
}

const neverReload = () => false

export function createAsyncRequire({
  moduleMap = {},
  resolveId = () => undefined,
  shouldReload = neverReload,
  isCompiledModule = () => true,
  compileModule,
  filterStack,
  nodeResolve,
}: RequireAsyncConfig = {}): RequireAsync {
  let callStack: (StackFrame | undefined)[] = []

  const mustCompile = (id: string, resolvedId: string) =>
    resolvedId[0] === '\0' ||
    id === resolvedId ||
    id.startsWith('virtual:') ||
    isCompiledModule(resolvedId) ||
    (resolvedId[0] === '/' && !fs.existsSync(resolvedId))

  return async function requireAsync(id, importer, isDynamic) {
    if (builtinModules.includes(id)) {
      return Module.createRequire(importer)(id)
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

    let isCached = true
    let exports: any
    let module: CompiledModule | undefined

    if (resolvedId && compileModule && mustCompile(id, resolvedId)) {
      await moduleMap.__compileQueue
      isCached = resolvedId in moduleMap && !shouldReload(resolvedId)
      if (isCached) {
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
      const nodeRequire = Module.createRequire(
        path.isAbsolute(importer) ? importer : path.resolve('index.js')
      )

      const restoreNodeResolve = nodeResolve
        ? hookNodeResolve(nodeResolve)
        : noop

      try {
        resolvedId = nodeRequire.resolve(id)
      } catch (error: any) {
        restoreNodeResolve()

        // Fall back to the Vite resolution if Node resolution fails.
        if (!resolvedId || !fs.existsSync(resolvedId)) {
          formatAsyncStack(error, moduleMap, asyncStack, filterStack)
          throw error
        }
      }

      const restoreModuleCache =
        shouldReload !== neverReload ? forceNodeReload(shouldReload) : noop

      const cached = getCachedModule(resolvedId)
      if (cached) {
        exports = cached.exports
        restoreNodeResolve()
        restoreModuleCache()
      } else {
        isCached = false
        const stopTracing = traceNodeRequire(
          moduleMap,
          asyncStack,
          resolvedId,
          filterStack
        )
        try {
          exports = nodeRequire(resolvedId)
        } catch (error: any) {
          formatAsyncStack(error, moduleMap, asyncStack, filterStack)
          throw error
        } finally {
          restoreNodeResolve()
          restoreModuleCache()
          stopTracing()
        }
      }
    }

    module?.importers.add(moduleMap[importer], isDynamic)
    if (!isDynamic) {
      callStack = callStack.slice(1)
    }

    if (!isCached && process.env.DEBUG) {
      debug(
        `Loaded %s in %sms`,
        kleur.cyan(relativeToCwd(resolvedId)),
        Date.now() - time
      )
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

export function injectExports(filename: string, exports: object) {
  const moduleCache = (Module as any)._cache as Record<string, NodeModule>
  const module = moduleCache[filename]
  if (module) {
    if (exports.constructor == Object) {
      Object.defineProperties(
        module.exports,
        Object.getOwnPropertyDescriptors(exports)
      )
    } else {
      module.exports = exports
    }
  } else {
    moduleCache[filename] = Object.assign(new Module(filename), {
      filename,
      exports,
      loaded: true,
    })
  }
}

function getCachedModule(id: string): NodeModule | undefined {
  return (Module as any)._cache[id]
}
