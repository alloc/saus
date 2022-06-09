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
import { getStackFrame, StackFrame } from '../utils/stack'
import { exportsId } from './compileEsm'
import { debug } from './debug'
import { executeModule } from './executeModule'
import { forceNodeReload } from './forceNodeReload'
import { formatAsyncStack, traceDynamicImport } from './formatAsyncStack'
import { hookNodeResolve, NodeResolveHook } from './hookNodeResolve'
import { registerModuleOnceCompiled } from './moduleMap'
import { getNodeModule, invalidateNodeModule } from './nodeModules'
import { traceNodeRequire } from './traceNodeRequire'
import {
  CompiledModule,
  CompileModuleHook,
  isLinkedModule,
  kLinkedModule,
  LinkedModule,
  LinkedModuleMap,
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
   * Any modules whose packages have been linked into the project's
   * `node_modules` directory will be tracked in here.
   */
  linkedModules?: LinkedModuleMap
  /**
   * Return `true` to mark an installed module as "live", implying that
   * its exports may be updated dynamically after being loaded.
   *
   * ⚠️ This is only called for files in `node_modules` directory.
   *
   * Live modules are added to the `linkedModules` map so their importers
   * can be reset with the `unloadModuleAndImporters` function.
   *
   * Use the `injectNodeModule` function to update a live module, but keep
   * in mind that importers won't be reset when you do.
   */
  isLiveModule?: (file: string) => boolean
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
  /**
   * Different modules may be resolved for SSR than for the client,
   * which your file watcher needs to know about, or else it won't
   * be able to reload the SSR-only modules when they're changed.
   */
  watchFile?: (file: string) => void
}

const isDebug = !!process.env.DEBUG
const neverReload = () => false

export function createAsyncRequire(
  config: RequireAsyncConfig = {}
): RequireAsync {
  const {
    moduleMap = {},
    linkedModules = {},
    isLiveModule = () => false,
    externalExports = new Map(),
    resolveId = () => undefined,
    compileModule,
    isCompiledModule = compileModule ? () => true : () => false,
    filterStack,
    nodeResolve,
    watchFile = noop,
  } = config

  let callStack: (StackFrame | undefined)[] = []

  const trackImport = (
    importerId: string,
    imported: CompiledModule | LinkedModule,
    isDynamic?: boolean,
    isConnected?: boolean
  ) => {
    const importer = moduleMap[importerId] || linkedModules[importerId]
    if (!importer) return
    if (isLinkedModule(importer)) {
      if (!isLinkedModule(imported)) {
        throw Error('Linked module cannot import a compiled module')
      }
      importer.imports.add(imported)
      imported.importers.add(importer)
    } else {
      importer.imports.add(imported)
      imported.importers.add(importer, isDynamic)
      if (isConnected) {
        connectModules(imported as CompiledModule, importer)
      }
    }
  }

  /**
   * Linked modules exist outside any `node_modules` directory, so there's
   * a possibility they'll need to be reloaded, while no such affordance
   * is made for normally installed dependencies (even though upgrading
   * a module with `npm install` is certainly possible, there ends up
   * being too many modules if we watch everything).
   *
   * To allow for linked modules to be reloaded, we have to track them
   * as well as their importers, since those will need to be reloaded
   * at the same time. Linked modules are assumed to use CommonJS.
   */
  const trackLinkedModule = (
    file: string,
    importer: string | null | undefined
  ) => {
    let linkedModule = linkedModules[file]
    if (!linkedModule) {
      watchFile(file)
      linkedModule = linkedModules[file] = {
        id: file,
        imports: new Set(),
        importers: new Set(),
        [kLinkedModule]: true,
      }
    }
    if (importer) {
      trackImport(importer, linkedModule)
    }
  }

  const isLinkedModuleId = (id: string) =>
    path.isAbsolute(id) && (!id.includes('/node_modules/') || isLiveModule(id))

  /**
   * When the importer is a linked module, wrap the `nodeResolve` hook so we
   * can intercept Node.js module resolution to track the graph of linked
   * modules being used.
   */
  const trackLinkedModules = (
    nodeResolve: NodeResolveHook | undefined,
    isImporterLinked: boolean
  ): NodeResolveHook =>
    !isImporterLinked
      ? nodeResolve!
      : (id, importer, resolve) => {
          const resolvedId =
            (nodeResolve && nodeResolve(id, importer, resolve)) ||
            resolve(id, importer)

          if (isLinkedModuleId(resolvedId)) {
            trackLinkedModule(resolvedId, importer)
          }

          return resolvedId
        }

  return async function requireAsync(id, importer, isDynamic) {
    if (builtinModules.includes(id)) {
      return Module.createRequire(importer || __filename)(id)
    }

    const time = Date.now()
    const asyncStack = isDynamic
      ? traceDynamicImport(Error(), 3)
      : (callStack = [getStackFrame(3), ...callStack])

    let shouldReload = config.shouldReload || neverReload
    let virtualId: string | undefined
    let resolvedId: string | undefined
    let nodeResolvedId: string | undefined
    let nodeRequire: NodeRequire

    resolveStep: try {
      const resolved = await resolveId(id, importer, isDynamic)
      if (resolved) {
        if (resolved.reload == false) {
          shouldReload = neverReload
        }
        const resolvedUrl = isExternalUrl(resolved.id) && resolved.id
        if (resolvedUrl) {
          if (resolvedUrl.endsWith('.json')) {
            return jsonImport(resolvedUrl)
          }
          return httpImport(resolvedUrl)
        }
        if (resolved.external) {
          if (isNodeRequirable(resolved.id)) {
            nodeResolvedId = resolved.id
            break resolveStep
          }
        } else {
          resolvedId = resolved.id
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
      } else if (path.isAbsolute(id)) {
        if (isCompiledModule(id)) {
          resolvedId = id
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

    let isCached = false
    let exports: any
    let module: CompiledModule | undefined

    loadStep: try {
      if (resolvedId && compileModule) {
        await moduleMap.__compileQueue

        module = moduleMap[resolvedId]
        if (module?.exports && !shouldReload(resolvedId)) {
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
          isCached = true
          exports = circularIndex >= 0 ? module.env[exportsId] : module.exports
          break loadStep
        }

        module ||= await registerModuleOnceCompiled(
          moduleMap,
          compileModule(resolvedId, requireAsync, virtualId).then(module => {
            if (module) {
              if (path.isAbsolute(resolvedId!) && fs.existsSync(resolvedId!)) {
                watchFile(resolvedId!)
              }
              return module
            }
            throw Object.assign(Error(`Cannot find module '${resolvedId}'`), {
              code: 'ERR_MODULE_NOT_FOUND',
            })
          })
        )

        exports = await executeModule(module)
      } else {
        resolvedId = nodeResolvedId!

        let isReloading: boolean
        if (externalExports.has(resolvedId)) {
          isReloading = shouldReload(resolvedId)
          if (!isReloading) {
            isCached = true
            exports = externalExports.get(resolvedId)
            break loadStep
          }
          // Delete the exports now, in case the module fails to load.
          externalExports.delete(resolvedId)
        }

        const cachedModule = getNodeModule(resolvedId)
        if (cachedModule) {
          isReloading ??= shouldReload(resolvedId)
          if (!isReloading) {
            isCached = true
            exports = cachedModule.exports
            externalExports.set(resolvedId, exports)
            break loadStep
          }
          invalidateNodeModule(resolvedId)
        }

        const restoreModuleCache =
          shouldReload !== neverReload ? forceNodeReload(shouldReload) : noop

        const isModuleLinked = isLinkedModuleId(resolvedId)
        const restoreNodeResolve =
          nodeResolve || isModuleLinked
            ? hookNodeResolve(trackLinkedModules(nodeResolve, isModuleLinked))
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
      // Track importers even when a compile/runtime error is encountered,
      // so that module reloading still works when a file is changed.
      if (module) {
        if (importer) {
          trackImport(importer, module, isDynamic, internalPathRE.test(id))
        }
      } else if (resolvedId && isLinkedModuleId(resolvedId)) {
        trackLinkedModule(resolvedId, importer)
      }
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

function createRequire(importer: string) {
  return Module.createRequire(
    path.isAbsolute(importer) ? importer : path.resolve('index.js')
  )
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
