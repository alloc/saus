import { debug } from '@/debug'
import { loadRoutes } from '@/loadRoutes'
import { globalCache } from '@/runtime/cache'
import {
  stateModulesByFile,
  stateModulesById,
} from '@/runtime/stateModules/global'
import { prependBase } from '@/utils/base'
import { defer, Deferred } from '@/utils/defer'
import { take } from '@/utils/take'
import { isLiveModule } from '@/vm/isLiveModule'
import {
  PurgeHandler,
  purgeModule,
  unloadModuleAndImporters,
} from '@/vm/moduleMap'
import { CompiledModule, isLinkedModule, LinkedModule } from '@/vm/types'
import { green, yellow } from 'kleur/colors'
import path from 'path'
import { Promisable } from 'type-fest'
import { DevContext } from './context'

const clientDir = path.resolve(__dirname, '../../client') + '/'

export interface HotReloadFn {
  (file: string, ssr?: boolean): Promise<void>
  get promise(): Promise<void>
  get nonce(): number
}

export interface HotReloadInfo {
  nonce: number
  routesChanged: boolean
}

export interface HotReloadHandler {
  /** A client module should be reloaded. */
  clientChange?: (url: string) => void
  /** The hot reloading is completed. */
  finish?: () => Promisable<void>
}

export interface HotReloadConfig {
  schedule: (reload: () => void) => void
  start?: (info: HotReloadInfo) => Promisable<HotReloadHandler>
  ssr?: boolean
}

export function createHotReload(
  context: DevContext,
  reloadConfig: HotReloadConfig
): HotReloadFn {
  const { server, events, liveModulePaths, logger } = context
  const { schedule, start = (): HotReloadHandler => ({}) } = reloadConfig

  const dirtyFiles = new Set<string>()
  const dirtyStateModules = new Set<CompiledModule>()
  const dirtyClientModules = new Set<string>()
  const dirtyLiveModules = new Map<string, Record<string, any>>()

  let nonce = 0
  let imminent = false
  let pendingReload: Deferred<void> | undefined
  let currentReload: Deferred<void> | undefined

  function scheduleReload() {
    imminent || schedule(reloadAffectedFiles)
  }

  async function reloadAffectedFiles() {
    if (currentReload) {
      imminent = true
      await currentReload
      imminent = false
    }

    nonce++
    currentReload = defer()
    pendingReload!.resolve(currentReload)
    pendingReload = undefined

    let stateCleared = 0
    let routesChanged = dirtyFiles.has(context.routesPath)

    dirtyFiles.clear()
    dirtyClientModules.clear()

    const handler = await start({
      nonce,
      routesChanged,
    })

    for (let [moduleId, liveExports] of dirtyLiveModules) {
      const exports = await context.ssrRequire(moduleId)
      replaceLiveExports(liveExports, exports)
    }
    dirtyLiveModules.clear()

    const { stateModuleBase } = context.app.config
    for (const { id } of dirtyStateModules) {
      const stateModules = take(stateModulesByFile, id)!
      const moduleIds = Array.from(stateModules.values(), module => {
        stateModulesById.delete(module.id)
        return module.id
      })

      // TODO: escape moduleIds for regex syntax
      const cacheKeyPatterns = new RegExp(
        '^(' + moduleIds.join('|') + ')(\\.[^.]+)?$'
      )

      globalCache.clear(key => {
        if (!cacheKeyPatterns.test(key)) {
          return false
        }
        if (handler.clientChange) {
          const url = prependBase(
            stateModuleBase + key + '.js',
            context.basePath
          )
          handler.clientChange(url)
        }
        stateCleared++
        return true
      })
    }
    dirtyStateModules.clear()

    if (routesChanged) {
      try {
        logger.info(yellow('⨠ Reloading routes...'))
        await loadRoutes(context)

        // Reload the client-side routes map.
        if (handler.clientChange) {
          handler.clientChange('/@fs' + path.join(clientDir, 'routes.ts'))
        }
      } catch (error: any) {
        routesChanged = false
        events.emit('error', error)
      }
    }

    if (handler.finish) {
      await handler.finish()
    }

    logger.clearScreen('info')
    if (stateCleared > 0) {
      logger.info(
        green('✔︎') + ` Cleared ${stateCleared} state entries from the cache.`
      )
    }
    if (routesChanged) {
      logger.info(green('✔︎') + ' Routes have been updated!')
    }

    currentReload.resolve()
    currentReload = undefined
  }

  async function reloadFile(file: string, ssr = reloadConfig.ssr) {
    const getPendingReload = () => {
      return (pendingReload ||= defer()).promise
    }
    if (dirtyFiles.has(file)) {
      return getPendingReload()
    }
    const moduleMap = context.moduleMap
    const changedModule = moduleMap.get(file) || context.linkedModules[file]
    if (changedModule) {
      while (moduleMap.promises.size) {
        await Promise.all(moduleMap.promises.values())
      }

      // State modules import "saus/client" to access the
      // `defineStateModule` function. Then the routes module imports
      // those state modules. But we want to avoid reloading the routes
      // module when the live exports of the "saus/client" module are
      // changed, since the routes module can't use them anyway.
      const skipRoutesPath =
        !dirtyFiles.has(context.routesPath) && file.startsWith(clientDir)

      const stateModuleFiles = new Set(
        Array.from(stateModulesByFile.keys(), file => moduleMap.get(file)!)
      )

      const acceptModule = (
        module: CompiledModule,
        dep?: CompiledModule | LinkedModule
      ) => {
        const viteModule = server.moduleGraph.getModuleById(module.id)
        if (viteModule) {
          if (viteModule.isSelfAccepting) {
            return true
          }
          const viteDep = dep && server.moduleGraph.getModuleById(dep?.id)
          if (viteDep && viteModule.acceptedHmrDeps.has(viteDep)) {
            return true
          }
        }
        return false
      }

      const resetStateModule = (module: CompiledModule) => {
        // Invalidate any cached state when a state module is reset.
        if (stateModuleFiles.has(module)) {
          dirtyStateModules.add(module)
          stateModuleFiles.delete(module)
        }

        // Any state module that dynamically imported this module needs
        // to invalidate any cached state it produced.
        for (const stateModule of stateModuleFiles) {
          if (module.importers.hasDynamic(stateModule)) {
            dirtyStateModules.add(stateModule)
            stateModuleFiles.delete(stateModule)
          }
        }
      }

      const clearExports = isLinkedModule(changedModule)
        ? (module: CompiledModule | LinkedModule) => {
            if (isLinkedModule(module)) {
              context.externalExports.delete(module.id)
            } else {
              resetStateModule(module)
            }
          }
        : resetStateModule

      const onPurge: PurgeHandler = (module, isAccepted, stopPropagation) => {
        // Live modules never have their exports destructured by
        // importers, so we don't have to reload those importers.
        if (ssr && isLiveModule(module, liveModulePaths)) {
          dirtyLiveModules.set(module.id, module.exports)
          stopPropagation()

          // Live importers must also be reloaded, in case they have
          // re-exported this module.
          for (const importer of module.importers)
            if (isLiveModule(importer, liveModulePaths))
              queueMicrotask(() => {
                reloadFile(importer.id, ssr)
              })
        }
        clearExports(module as any)
        if (!isAccepted && !ssr) {
          dirtyClientModules.add(module.id)
        }
      }
      if (isLinkedModule(changedModule)) {
        unloadModuleAndImporters(changedModule, {
          touched: dirtyFiles,
          accept: acceptModule,
          onPurge,
        })
      } else {
        purgeModule(changedModule, {
          touched: dirtyFiles,
          accept: acceptModule,
          onPurge,
        })
      }
      if (skipRoutesPath) {
        dirtyFiles.delete(context.routesPath)
      }
      scheduleReload()
      return getPendingReload()
    }
    // In the event of a syntax error, the routes module won't exist in
    // the module map, but it still needs to be reloaded on file change.
    if (file == context.routesPath) {
      dirtyFiles.add(file)
      scheduleReload()
      return getPendingReload()
    }
    // Restart the server when Vite config is changed.
    if (file == context.configPath) {
      // Prevent handling by Vite.
      context.config.server.hmr = false
      // Skip SSR reloading by Saus.
      dirtyFiles.clear()

      debug(`Vite config changed. Restarting server.`)
      return events.emit('restart')
    }
  }

  const hotReload = reloadFile as HotReloadFn
  Object.defineProperty(hotReload, 'promise', {
    get: () => Promise.resolve(pendingReload || currentReload),
    enumerable: true,
  })
  Object.defineProperty(hotReload, 'nonce', {
    get: () => nonce,
    enumerable: true,
  })
  return hotReload
}

function replaceLiveExports(
  liveExports: Record<string, any>,
  exports: Record<string, any>
) {
  for (const key in Object.getOwnPropertyDescriptors(liveExports)) {
    if (!(key in exports)) {
      delete liveExports[key]
    }
  }
  for (const key in Object.getOwnPropertyDescriptors(exports)) {
    Object.defineProperty(liveExports, key, {
      ...Object.getOwnPropertyDescriptor(exports, key),
      configurable: true,
    })
  }
}
