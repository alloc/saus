import { debug } from '@/debug'
import { loadRoutes } from '@/loadRoutes'
import { clearCachedState } from '@/runtime/clearCachedState'
import { prependBase } from '@/utils/base'
import { defer, Deferred } from '@/utils/defer'
import { purgeModule, unloadModuleAndImporters } from '@/vm/moduleMap'
import { CompiledModule, isLinkedModule, LinkedModule } from '@/vm/types'
import { green, yellow } from 'kleur/colors'
import path from 'path'
import { Promisable } from 'type-fest'
import { DevContext } from './context'

const clientDir = path.resolve(__dirname, '../../client') + '/'

export interface HotReloadFn {
  (file: string): Promise<void>
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
}

export function createHotReload(
  context: DevContext,
  reloadConfig: HotReloadConfig
): HotReloadFn {
  const { server, events, logger } = context
  const { schedule, start = (): HotReloadHandler => ({}) } = reloadConfig

  const dirtyFiles = new Set<string>()
  const dirtyStateModules = new Set<CompiledModule>()
  const dirtyClientModules = new Set<string>()

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

    let routesChanged = dirtyFiles.has(context.routesPath)
    dirtyFiles.clear()
    dirtyClientModules.clear()

    const handler = await start({
      nonce,
      routesChanged,
    })

    const { stateModuleBase } = context.app.config
    for (const { id } of dirtyStateModules) {
      const stateModuleIds = context.stateModulesByFile[id]
      clearCachedState(key => {
        const isMatch = stateModuleIds.some(
          moduleId => key == moduleId || key.startsWith(moduleId + '.')
        )
        if (isMatch && handler.clientChange) {
          const url = prependBase(
            stateModuleBase + key + '.js',
            context.basePath
          )
          handler.clientChange(url)
        }
        return isMatch
      })
    }
    dirtyStateModules.clear()

    if (routesChanged) {
      try {
        logger.info(yellow('⨠ Reloading routes...'))
        await loadRoutes(context)
        logger.info(green('✔︎ Routes are ready!'), { clear: true })

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

    currentReload.resolve()
    currentReload = undefined
  }

  async function reloadFile(file: string) {
    const getPendingReload = () => {
      return (pendingReload ||= defer()).promise
    }
    if (dirtyFiles.has(file)) {
      return getPendingReload()
    }
    const moduleMap = context.moduleMap
    const changedModule = moduleMap[file] || context.linkedModules[file]
    if (changedModule) {
      await moduleMap.__compileQueue

      // State modules import "saus/client" to access the `defineStateModule`
      // function. Then the routes module imports those state modules.
      // But we want to avoid reloading the routes module when the live exports
      // of the "saus/client" module are changed, since the routes module can't
      // use them anyway.
      const skipRoutesPath =
        !dirtyFiles.has(context.routesPath) && file.startsWith(clientDir)

      const stateModules = new Set(
        Object.keys(context.stateModulesByFile).map(file => moduleMap[file]!)
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
        if (stateModules.has(module)) {
          dirtyStateModules.add(module)
          stateModules.delete(module)
        }

        // Any state module that dynamically imported this module
        // needs to invalidate any cached state it produced.
        for (const stateModule of stateModules) {
          if (module.importers.hasDynamic(stateModule)) {
            dirtyStateModules.add(stateModule)
            stateModules.delete(stateModule)
          }
        }
      }
      if (isLinkedModule(changedModule)) {
        unloadModuleAndImporters(changedModule, {
          touched: dirtyFiles,
          accept: acceptModule,
          onPurge(module, isAccepted) {
            if (isLinkedModule(module)) {
              context.externalExports.delete(module.id)
            } else {
              resetStateModule(module)
            }
            if (!isAccepted) {
              dirtyClientModules.add(module.id)
            }
          },
        })
      } else {
        purgeModule(changedModule, {
          touched: dirtyFiles,
          accept: acceptModule,
          onPurge(module, isAccepted) {
            resetStateModule(module)
            if (!isAccepted) {
              dirtyClientModules.add(module.id)
            }
          },
        })
      }
      if (skipRoutesPath) {
        dirtyFiles.delete(context.routesPath)
      }
      scheduleReload()
      return getPendingReload()
    }
    // In the event of a syntax error, the routes module won't exist in the
    // module map, but it still needs to be reloaded on file change.
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
      events.emit('restart')
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
