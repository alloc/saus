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
import { isExternalUrl } from '../utils/isExternalUrl'
import { httpImport } from '../bundle/httpImport'
import { jsonImport } from '../runtime/jsonImport'

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

const isDebug = !!process.env.DEBUG
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

  return async function requireAsync(id, importer, isDynamic) {
    if (builtinModules.includes(id)) {
      return Module.createRequire(importer)(id)
    }

    const time = Date.now()
    const asyncStack = isDynamic
      ? traceDynamicImport(Error())
      : (callStack = [getStackFrame(3), ...callStack])

    let resolvedId: string | undefined
    let nodeResolvedId: string | undefined
    let nodeRequire: NodeRequire

    resolveStep: {
      try {
        resolvedId = await resolveId(id, importer, isDynamic)
      } catch (error: any) {
        formatAsyncStack(error, moduleMap, asyncStack, filterStack)
        throw error
      }

      if (resolvedId) {
        if (isExternalUrl(resolvedId)) {
          if (resolvedId.endsWith('.json')) {
            return jsonImport(resolvedId)
          }
          return httpImport(resolvedId)
        }
        if (isVirtual(id, resolvedId)) {
          break resolveStep
        }
        if (isCompiledModule(resolvedId)) {
          break resolveStep
        }
        if (!/\.[mc]?js(on)?$/.test(resolvedId)) {
          break resolveStep
        }
      }

      const restoreNodeResolve = nodeResolve
        ? hookNodeResolve(nodeResolve)
        : noop

      try {
        nodeRequire = createRequire(importer)
        nodeResolvedId = nodeRequire.resolve(id)
        if (resolvedId) {
          if (isNodeRequirable(resolvedId)) {
            nodeResolvedId = resolvedId
          } else if (!isNodeRequirable(nodeResolvedId)) {
            if (isDebug) {
              debug(
                `Compiling %s for Node compat`,
                kleur.yellow(toDebugPath(resolvedId))
              )
            }
            break resolveStep
          }
        }
      } catch (error: any) {
        if (!resolvedId) {
          formatAsyncStack(error, moduleMap, asyncStack, filterStack)
          throw error
        }
        if (!isNodeRequirable(resolvedId)) {
          if (isDebug) {
            debug(
              `Compiling %s for Node compat`,
              kleur.yellow(toDebugPath(resolvedId))
            )
          }
          break resolveStep
        }
        // Use the custom resolution if Node resolution fails.
        nodeResolvedId = resolvedId
      } finally {
        restoreNodeResolve()
      }
      resolvedId = undefined
    }

    let isCached: boolean
    let exports: any
    let module: CompiledModule | undefined

    loadStep: {
      if (resolvedId && compileModule) {
        await moduleMap.__compileQueue

        isCached = resolvedId in moduleMap && !shouldReload(resolvedId)
        if (isCached) {
          module = moduleMap[resolvedId]
          const circularIndex = asyncStack.findIndex(
            frame => frame?.file == resolvedId
          )
          if (circularIndex >= 0 && isDebug) {
            const importLoop = asyncStack
              .slice(0, circularIndex + 1)
              .filter(Boolean)
              .map(frame => (frame as StackFrame).file)
              .reverse()
              .concat(resolvedId)

            debug(
              `Circular import may lead to unexpected behavior\n `,
              importLoop.map(toDebugPath).join(' → ')
            )
          }
          exports = circularIndex >= 0 ? module.env[exportsId] : module.exports
          break loadStep
        }

        module = await updateModuleMap(
          moduleMap,
          compileModule(resolvedId, requireAsync).then(module => {
            if (!module) {
              const error = Object.assign(
                Error(`Cannot find module '${resolvedId}'`),
                { code: 'ERR_MODULE_NOT_FOUND' }
              )
              formatAsyncStack(error, moduleMap, asyncStack, filterStack)
              throw error
            }
            return module
          })
        )

        try {
          exports = await executeModule(module)
        } catch (error: any) {
          formatAsyncStack(error, moduleMap, asyncStack, filterStack)
          throw error
        }
      } else {
        resolvedId = nodeResolvedId!

        const restoreModuleCache =
          shouldReload !== neverReload ? forceNodeReload(shouldReload) : noop

        const cached = getCachedModule(resolvedId)
        if ((isCached = !!cached)) {
          exports = cached.exports
          restoreModuleCache()
          break loadStep
        }

        const restoreNodeResolve = nodeResolve
          ? hookNodeResolve(nodeResolve)
          : noop

        const stopTracing = traceNodeRequire(
          moduleMap,
          asyncStack,
          resolvedId,
          filterStack
        )

        try {
          exports = nodeRequire!(resolvedId)
        } catch (error: any) {
          formatAsyncStack(error, moduleMap, asyncStack, filterStack)
          throw error
        } finally {
          restoreModuleCache()
          restoreNodeResolve()
          stopTracing()
        }
      }
    }

    module?.importers.add(moduleMap[importer], isDynamic)
    if (!isDynamic) {
      callStack = callStack.slice(1)
    }

    if (!isCached && isDebug) {
      debug(
        `Loaded %s in %sms`,
        kleur.cyan(toDebugPath(resolvedId)),
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

  return modulePromise
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

function createRequire(importer: string) {
  return Module.createRequire(
    path.isAbsolute(importer) ? importer : path.resolve('index.js')
  )
}

function getCachedModule(id: string): NodeModule | undefined {
  return (Module as any)._cache[id]
}

const nodeExtensions = Module.createRequire(__filename).extensions

function isNodeRequirable(file: string) {
  const ext = path.extname(file)
  if (ext !== '.js') {
    return ext == '.cjs' || ext in nodeExtensions
  }
  try {
    const code = fs.readFileSync(file, 'utf8')
    return !/^(im|ex)port /m.test(code)
  } catch {
    return false
  }
}

function isVirtual(id: string, resolvedId: string) {
  return (
    resolvedId[0] === '\0' || id === resolvedId || id.startsWith('virtual:')
  )
}

function toDebugPath(file: string) {
  return fs.existsSync(file.replace(/[#?].*$/, '')) ? relativeToCwd(file) : file
}
