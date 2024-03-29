import { internalPathRE } from '@utils/importRegex'
import { isExternalUrl } from '@utils/isExternalUrl'
import { getStackFrame, StackFrame } from '@utils/node/stack'
import { toDebugPath } from '@utils/node/toDebugPath'
import { noop } from '@utils/noop'
import builtinModules from 'builtin-modules'
import esModuleLexer from 'es-module-lexer'
import fs from 'fs'
import kleur from 'kleur'
import { Module } from 'module'
import path from 'path'
import { exportsId } from './compileEsm'
import { debug } from './debug'
import { executeModule } from './executeModule'
import { forceNodeReload } from './forceNodeReload'
import { formatAsyncStack, traceDynamicImport } from './formatAsyncStack'
import { hookNodeResolve, NodeResolveHook } from './hookNodeResolve'
import { ModuleMap } from './moduleMap'
import { getNodeModule, unloadNodeModule } from './nodeModules'
import { traceNodeRequire } from './traceNodeRequire'
import {
  CompiledModule,
  CompileModuleHook,
  isLinkedModule,
  kLinkedModule,
  LinkedModuleMap,
  RequireAsync,
  ResolveIdHook,
  TrackedModule,
} from './types'

export interface RequireAsyncState {
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
}

export interface RequireAsyncConfig extends RequireAsyncState {
  timeout?: number
  /**
   * Called when a compiled/linked module has been loaded
   * into memory, either initially or from a hot reload.
   *
   * The `requireTime` includes time spent loading dependencies.
   */
  onModuleLoaded?: (
    id: string,
    requireTime: number,
    module?: CompiledModule | null
  ) => void
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
  httpImport?: (url: string) => Promise<any>
  jsonImport?: (url: string) => Promise<{ default: any }>
}

const isDebug = !!process.env.DEBUG
const neverReload = () => false

export function createAsyncRequire(
  config: RequireAsyncConfig = {}
): RequireAsync {
  const {
    moduleMap = new ModuleMap(),
    linkedModules = {},
    isLiveModule = () => false,
    externalExports = new Map(),
    resolveId = () => undefined,
    compileModule,
    isCompiledModule = compileModule ? () => true : () => false,
    filterStack,
    nodeResolve,
    watchFile = noop,
    httpImport,
    jsonImport,
  } = config

  const watchModuleOrThrow = (
    moduleId: string,
    module: CompiledModule | null
  ) => {
    if (module) {
      path.isAbsolute(module.id) &&
        fs.existsSync(module.id) &&
        watchFile(module.id)
      return module
    }
    throw Object.assign(Error(`Cannot find module '${moduleId}'`), {
      code: 'ERR_MODULE_NOT_FOUND',
    })
  }

  const trackImport = (
    importerId: string,
    imported: TrackedModule,
    isDynamic?: boolean,
    isConnected?: boolean
  ) => {
    const importer = moduleMap.get(importerId) || linkedModules[importerId]
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
    importer: string | null | undefined,
    getExports: () => any
  ) => {
    let linkedModule = linkedModules[file]
    if (!linkedModule) {
      watchFile(file)
      linkedModule = linkedModules[file] = {
        id: file,
        exports: null,
        imports: new Set(),
        importers: new Set(),
        [kLinkedModule]: true,
      }
    }
    Object.defineProperty(linkedModule, 'exports', {
      get: getExports,
      configurable: true,
    })
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
    importer: string
  ): NodeResolveHook | undefined =>
    !isLinkedModuleId(importer)
      ? nodeResolve
      : (id, importer, resolve) => {
          const resolvedId =
            (nodeResolve && nodeResolve(id, importer, resolve)) ||
            resolve(id, importer)

          if (isLinkedModuleId(resolvedId)) {
            trackLinkedModule(resolvedId, importer, () => {
              return getNodeModule(resolvedId)?.exports
            })
          }

          return resolvedId
        }

  return async function requireAsync(
    id,
    parentId,
    isDynamic,
    framesToPop = 0,
    timeout
  ) {
    if (builtinModules.includes(id)) {
      const nodeRequire = Module.createRequire(parentId || __filename)
      return nodeRequire(id)
    }

    const parentModule = parentId
      ? moduleMap.get(parentId) || linkedModules[parentId]
      : null

    // Always exclude this function.
    framesToPop++

    let requireStack: (StackFrame | undefined)[]
    if (isDynamic) {
      requireStack = traceDynamicImport(Error(), framesToPop)
    } else {
      requireStack = parentModule?.requireStack || []
      requireStack = [getStackFrame(framesToPop), ...requireStack]
    }

    let shouldReload = config.shouldReload || neverReload
    let virtualId: string | undefined
    let resolvedId: string | undefined
    let nodeResolvedId: string | undefined
    let nodeRequire: NodeRequire

    const time = Date.now()

    resolveStep: try {
      const resolved = await resolveId(id, parentId, isDynamic)
      if (resolved) {
        if (resolved.reload == false) {
          shouldReload = neverReload
        }
        const resolvedUrl = isExternalUrl(resolved.id) && resolved.id
        if (jsonImport && resolvedUrl && resolvedUrl.endsWith('.json')) {
          return jsonImport(resolvedUrl)
        }
        if (httpImport && resolvedUrl) {
          return httpImport(resolvedUrl)
        }
        if (resolved.external) {
          if (isNodeRequirable(resolved.id)) {
            nodeRequire = createRequire(parentId || __filename)
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
        nodeRequire = createRequire(parentId || __filename)
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
      formatAsyncStack(error, moduleMap, requireStack, filterStack)
      throw error
    }

    let isCached = false
    let exports: any
    let module: CompiledModule | null | undefined

    loadStep: try {
      if (resolvedId && compileModule) {
        module = moduleMap.get(resolvedId)
        if (!module) {
          const modulePromise = moduleMap.promises.get(resolvedId)
          // Check whether the modulePromise exists before awaiting, so
          // the `moduleMap.setPromise` call below won't be delayed when
          // the module is unknown.
          if (modulePromise) {
            module = await modulePromise
          }
        }
        if (module?.exports && !shouldReload(resolvedId)) {
          const circularIndex = requireStack.findIndex(
            frame => frame?.file == resolvedId
          )
          if (circularIndex >= 0 && isDebug) {
            const importLoop = requireStack
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
        module ||= watchModuleOrThrow(
          resolvedId,
          await moduleMap.setPromise(
            resolvedId,
            compileModule(resolvedId, requireAsync, virtualId)
          )
        )
        exports = await executeModule(
          module,
          timeout ?? config.timeout,
          requireStack
        )
      } else {
        resolvedId = nodeResolvedId!

        let isReloading: boolean | undefined
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
          if (!isReloading || cachedModule.reload == false) {
            isCached = true
            exports = cachedModule.exports
            externalExports.set(resolvedId, exports)
            break loadStep
          }
          unloadNodeModule(resolvedId)
        }

        const restoreModuleCache =
          shouldReload !== neverReload
            ? forceNodeReload((id, cached) => {
                return shouldReload(id) && cached.reload !== false
              })
            : noop

        const wrappedNodeResolve = trackLinkedModules(nodeResolve, resolvedId)
        const restoreNodeResolve = wrappedNodeResolve
          ? hookNodeResolve(wrappedNodeResolve)
          : noop

        const stopTracing = traceNodeRequire(
          moduleMap,
          requireStack,
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
      formatAsyncStack(error, moduleMap, requireStack, filterStack)
      throw error
    } finally {
      // Track importers even when a compile/runtime error is encountered,
      // so that module reloading still works when a file is changed.
      if (module) {
        if (parentId) {
          trackImport(parentId, module, isDynamic, internalPathRE.test(id))
        }
      } else if (resolvedId && isLinkedModuleId(resolvedId)) {
        trackLinkedModule(resolvedId, parentId, () => exports)
      }
    }

    // Dynamic import() aliases the JSON as the default export.
    if (isDynamic && resolvedId.endsWith('.json')) {
      exports = { default: exports }
    }

    if (!isCached) {
      const requireTime = Date.now() - time
      config.onModuleLoaded?.(resolvedId, requireTime, module)
      if (module) {
        module.requireTime = requireTime
      }
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
    if (/\b(import|export)\b/.test(code)) {
      const [imports, exports] = esModuleLexer.parse(code, file)
      return !imports.length && !exports.length
    }
    return true
  } catch {
    return false
  }
}

function isVirtual(id: string, resolvedId: string) {
  return (
    resolvedId[0] === '\0' ||
    id.startsWith('virtual:') ||
    id.includes('?') ||
    (id === resolvedId && !(path.isAbsolute(id) && fs.existsSync(id)))
  )
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
