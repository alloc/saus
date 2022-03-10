import builtinModules from 'builtin-modules'
import fs from 'fs'
import kleur from 'kleur'
import { Module } from 'module'
import path from 'path'
import { httpImport } from '../http/httpImport'
import { jsonImport } from '../http/jsonImport'
import { internalPathRE } from '../utils/importRegex'
import { isExternalUrl } from '../utils/isExternalUrl'
import { noop } from '../utils/noop'
import { relativeToCwd } from '../utils/relativeToCwd'
import { getStackFrame, StackFrame } from '../utils/resolveStackTrace'
import { exportsId } from './compileEsm'
import { debug } from './debug'
import { executeModule } from './executeModule'
import { forceNodeReload } from './forceNodeReload'
import { formatAsyncStack, traceDynamicImport } from './formatAsyncStack'
import { hookNodeResolve, NodeResolveHook } from './hookNodeResolve'
import { registerModuleOnceCompiled } from './moduleMap'
import { traceNodeRequire } from './traceNodeRequire'
import {
  CompiledModule,
  CompileModuleHook,
  ModuleMap,
  RequireAsync,
  ResolveIdHook,
} from './types'

export type RequireAsyncConfig = {
  /**
   * Reuse compiled modules between `createAsyncRequire` calls,
   * and wield full control over them.
   */
  moduleMap?: ModuleMap
  /**
   * Modules loaded with Node's module loader (instead of Vite-based compilation)
   * have their exports cached in here.
   *
   * This lets us prevent compiled modules from using different instances of the
   * same external module; for example, if two compiled modules were reloaded
   * separately, and an external module was cleared (from Node's require cache)
   * before the last one could reload, this cache will prevent another instance
   * of the external module from being loaded by a compiled import.
   */
  externalExports?: Map<string, any>
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
  externalExports = new Map(),
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
      return Module.createRequire(importer || __filename)(id)
    }

    const time = Date.now()
    const asyncStack = isDynamic
      ? traceDynamicImport(Error(), 3)
      : (callStack = [getStackFrame(3), ...callStack])

    let virtualId: string | undefined
    let resolvedId: string | undefined
    let nodeResolvedId: string | undefined
    let nodeRequire: NodeRequire

    resolveStep: try {
      resolvedId = await resolveId(id, importer, isDynamic)
      if (resolvedId) {
        if (isExternalUrl(resolvedId)) {
          if (resolvedId.endsWith('.json')) {
            return jsonImport(resolvedId)
          }
          return httpImport(resolvedId)
        }
        if (isVirtual(id, resolvedId)) {
          virtualId = id
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
        nodeRequire = createRequire(importer || __filename)
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
    } catch (error: any) {
      if (!isDynamic) {
        callStack = callStack.slice(1)
      }
      formatAsyncStack(error, moduleMap, asyncStack, filterStack)
      throw error
    }

    let isCached: boolean
    let exports: any
    let module: CompiledModule | undefined
    let importerModule: CompiledModule | undefined

    loadStep: try {
      if (resolvedId && compileModule) {
        await moduleMap.__compileQueue

        module = moduleMap[resolvedId]
        if (importer) {
          importerModule = moduleMap[importer]
        }

        isCached = !!module?.exports && !shouldReload(resolvedId)
        if (isCached) {
          if (importerModule && internalPathRE.test(id)) {
            connectModules(module, importerModule)
          }
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

        module ||= await registerModuleOnceCompiled(
          moduleMap,
          compileModule(resolvedId, requireAsync, virtualId).then(module => {
            if (module) {
              return module
            }
            throw Object.assign(Error(`Cannot find module '${resolvedId}'`), {
              code: 'ERR_MODULE_NOT_FOUND',
            })
          })
        )

        if (importerModule && internalPathRE.test(id)) {
          connectModules(module, importerModule)
        }

        exports = await executeModule(module)
      } else {
        resolvedId = nodeResolvedId!

        let isReloading = false
        if (externalExports.has(resolvedId)) {
          if (!(isReloading = shouldReload(resolvedId))) {
            isCached = true
            exports = externalExports.get(resolvedId)
            break loadStep
          }
          // Delete the exports now, in case the module fails to load.
          externalExports.delete(resolvedId)
        }

        const cached = isReloading ? null : getCachedModule(resolvedId)
        if ((isCached = !!cached)) {
          exports = cached.exports
          externalExports.set(resolvedId, exports)
          break loadStep
        }

        const restoreModuleCache =
          shouldReload !== neverReload ? forceNodeReload(shouldReload) : noop

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
          externalExports.set(resolvedId, exports)
        } catch (error: any) {
          formatAsyncStack(error, moduleMap, asyncStack, filterStack)
          throw error
        } finally {
          restoreModuleCache()
          restoreNodeResolve()
          stopTracing()
        }
      }
    } catch (error: any) {
      formatAsyncStack(error, moduleMap, asyncStack, filterStack)
      throw error
    } finally {
      if (!isDynamic) {
        callStack = callStack.slice(1)
      }
    }

    if (module && importerModule) {
      importerModule.imports.add(module)
      module.importers.add(importerModule, isDynamic)
    }

    if (!isCached && isDebug) {
      const loadTime = Date.now() - time
      if (loadTime > 500)
        debug(
          `Loaded %s in %ss`,
          kleur.cyan(toDebugPath(resolvedId)),
          (Math.floor(loadTime / 100) / 10).toFixed(2)
        )
    }

    return exports
  }
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
    resolvedId[0] === '\0' ||
    id.startsWith('virtual:') ||
    (id === resolvedId && !(path.isAbsolute(id) && fs.existsSync(id)))
  )
}

function toDebugPath(file: string) {
  return fs.existsSync(file.replace(/[#?].*$/, '')) ? relativeToCwd(file) : file
}

/**
 * Ensure both modules are in the same `package` set.
 */
function connectModules(imported: CompiledModule, importer: CompiledModule) {
  let importerPkg = importer.package!
  let importedPkg = imported.package
  if (importedPkg) {
    if (importerPkg == importedPkg) {
      return
    }
    if (importerPkg) {
      importedPkg.forEach(module => {
        importerPkg.add(module)
        module.package = importerPkg
      })
    } else {
      importedPkg.add(importer)
      importer.package = importedPkg
    }
  } else {
    if (importerPkg) {
      importerPkg.add(imported)
    } else {
      importerPkg = new Set([importer, imported])
      importer.package = importerPkg
    }
    imported.package = importerPkg
  }
}
