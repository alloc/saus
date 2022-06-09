import { addExitCallback, removeExitCallback } from 'catch-exit'
import { EventEmitter } from 'events'
import http from 'http'
import { bold, gray, green, red, yellow } from 'kleur/colors'
import path from 'path'
import { StrictEventEmitter } from 'strict-event-emitter-types'
import { debounce } from 'ts-debounce'
import { inspect } from 'util'
import * as vite from 'vite'
import { createDevApp } from './app/createDevApp'
import { App } from './app/types'
import { getPageFilename, ResolvedConfig } from './core'
import { DevContext, loadContext } from './core/context'
import { debug } from './core/debug'
import { Endpoint } from './core/endpoint'
import { createFullReload } from './core/fullReload'
import { getRequireFunctions } from './core/getRequireFunctions'
import { loadConfigHooks } from './core/loadConfigHooks'
import { loadRenderers } from './core/loadRenderers'
import { loadRoutes } from './core/loadRoutes'
import { clientDir, runtimeDir } from './core/paths'
import { defineClientContext } from './plugins/clientContext'
import { getClientUrl, serveClientEntries } from './plugins/clientEntries'
import { transformClientState } from './plugins/clientState'
import { moduleRedirection, redirectModule } from './plugins/moduleRedirection'
import { renderPlugin } from './plugins/render'
import { routesPlugin } from './plugins/routes'
import { servePlugin } from './plugins/serve'
import { clearCachedState } from './runtime/clearCachedState'
import { prependBase } from './utils/base'
import { defer } from './utils/defer'
import { formatAsyncStack } from './vm/formatAsyncStack'
import { purgeModule, unloadModuleAndImporters } from './vm/moduleMap'
import {
  CompiledModule,
  isLinkedModule,
  LinkedModule,
  ModuleMap,
  ResolveIdHook,
} from './vm/types'

export interface SausDevServer {
  (req: http.IncomingMessage, res: http.ServerResponse, next?: () => void): void

  events: SausDevServer.EventEmitter
  restart(): void
  close(): Promise<void>
}

export namespace SausDevServer {
  export interface Events {
    listening(): void
    restart(): void
    close(): void
    error(e: any): void
  }
  export type EventEmitter = StrictEventEmitter<
    import('events').EventEmitter,
    Events
  >
}

export async function createServer(
  inlineConfig?: vite.UserConfig
): Promise<SausDevServer> {
  const events: SausDevServer.EventEmitter = new EventEmitter()
  const createContext = () =>
    loadContext<DevContext>('serve', inlineConfig, [
      servePlugin(e => events.emit('error', e)),
      serveClientEntries,
      routesPlugin(),
      renderPlugin,
      defineClientContext,
      transformClientState,
      () =>
        moduleRedirection([
          redirectModule(
            path.join(runtimeDir, 'loadStateModule.ts'),
            path.join(clientDir, 'loadStateModule.ts')
          ),
        ]),
    ])

  let context = await createContext()
  let moduleMap: ModuleMap = {}

  events.on('error', onError)
  events.on('restart', restart)

  let server: vite.ViteDevServer | null = null
  let serverPromise = startServer(context, moduleMap, events)

  // Stop promises from crashing the process.
  process.on('unhandledRejection', onError)

  function restart() {
    serverPromise = serverPromise.then(async oldServer => {
      try {
        await oldServer?.close()
      } catch {}

      context.logger.clearScreen('info')
      context = await createContext()
      server = await startServer(context, (moduleMap = {}), events, true)
      return server
    })
    serverPromise.catch(onError)
  }

  function onError(error: any) {
    if (error.code == 'EADDRINUSE') return
    const { logger } = context
    if (!logger.hasErrorLogged(error)) {
      formatAsyncStack(error, moduleMap, [], context.config.filterStack)
      logger.error(formatError(error, context.app), { error })
    }
  }

  server = await serverPromise

  const onExit = addExitCallback((signal, exitCode, error) => {
    if (error) {
      formatAsyncStack(error, moduleMap, [], context.config.filterStack)
    }
  })

  function middleware(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next?: () => void
  ): void {
    serverPromise.then(server => {
      if (server) {
        server.middlewares(req, res, next)
      } else if (next) {
        next()
      }
    }, next)
  }

  middleware.events = events
  middleware.restart = restart
  middleware.close = async () => {
    process.off('unhandledRejection', onError)
    events.emit('close')
    try {
      const server = await serverPromise
      await server?.close()
    } catch (e) {
      onError(e)
    } finally {
      removeExitCallback(onExit)
    }
  }

  return middleware
}

async function startServer(
  context: DevContext,
  moduleMap: ModuleMap,
  events: SausDevServer.EventEmitter,
  isRestart?: boolean
) {
  const { config, logger } = context
  const server = await vite.createServer(config)

  // Listen immediately to ensure `buildStart` hook is called.
  if (server.httpServer) {
    await listen(server, events, isRestart)

    if (logger.isLogged('info')) {
      logger.info('')
      server.printUrls()
      server.bindShortcuts()
      logger.info('')
    }
  }

  // Ensure the Vite config is watched.
  const watcher = server.watcher!
  if (context.configPath) {
    watcher.add(context.configPath)
  }

  const resolveId: ResolveIdHook = (id, importer) =>
    server.pluginContainer.resolveId(id, importer!, { ssr: true })

  context.server = server
  context.watcher = watcher
  context.moduleMap = moduleMap
  context.externalExports = new Map()
  context.linkedModules = {}
  context.liveModulePaths = []
  Object.assign(context, getRequireFunctions(context, resolveId))

  // Force all node_modules to be reloaded
  context.ssrForceReload = createFullReload()
  try {
    await loadRoutes(context, resolveId)
    await loadRenderers(context)
  } catch (e: any) {
    events.emit('error', e)
  }
  context.ssrForceReload = undefined

  await prepareDevApp(context, config, events, resolveId)
  watcher.prependListener('change', context.hotReload)

  // Use process.nextTick to ensure whoever is awaiting the `createServer`
  // call can handle this event.
  process.nextTick(() => {
    events.emit('listening')
  })

  return server
}

function listen(
  server: vite.ViteDevServer,
  events: SausDevServer.EventEmitter,
  isRestart?: boolean
): Promise<void> {
  let listening = false

  const { resolve, promise } = defer<void>()
  events.once('close', () => resolve())

  // When optimizing deps, a syntax error may be hit. If so, we need to
  // handle it here by waiting for the offending file to be updated, and
  // try to optimize again once updated.
  server.httpServer!.on('error', (error: any) => {
    events.emit('error', error)

    // ESBuild syntax errors have an "errors" array property.
    if (!listening && Array.isArray(error.errors)) {
      const files = new Set<string>()
      error.errors.forEach((e: any) => {
        const file = e.location?.file
        if (file && typeof file == 'string') {
          files.add(path.resolve(server.config.root, file))
        }
      })
      if (files.size) {
        waitForChanges(files, server, events, listen)
      }
    }
  })

  const listen = async () => {
    try {
      if (await server.listen(undefined, isRestart)) {
        listening = true
        resolve()
      }
    } catch {}
  }

  listen()
  return promise
}

function waitForChanges(
  input: string | Set<string>,
  server: vite.ViteDevServer,
  events: SausDevServer.EventEmitter,
  callback: () => void
) {
  const { logger } = server.config
  const watcher = server.watcher!

  const files = typeof input === 'string' ? new Set([input]) : input
  const onChange = (file: string) => {
    if (files.has(file)) {
      watcher.off('change', onChange)
      events.off('close', onClose)

      logger.clearScreen('info')
      callback()
    }
  }

  const onClose = () => {
    watcher.off('change', onChange)
  }

  watcher.on('change', onChange)
  events.on('close', onClose)

  logger.info('\n' + gray('Waiting for changes...'))
}

async function prepareDevApp(
  context: DevContext,
  config: ResolvedConfig,
  events: EventEmitter,
  resolveId: ResolveIdHook
) {
  const { server, watcher } = context
  const failedRequests = new Set<Endpoint.Request>()

  await resetDevApp()
  async function resetDevApp() {
    context.app = await createDevApp(context, error => {
      if (error.req) {
        failedRequests.add(error.req)
      }
      events.emit('error', error)
    })
  }

  const dirtyFiles = new Set<string>()
  const dirtyStateModules = new Set<CompiledModule>()
  const dirtyClientModules = new Set<string>()
  let isReloadPending = false

  const scheduleReload = debounce(async () => {
    if (isReloadPending) return
    isReloadPending = true

    // Wait for reloading to finish.
    while (context.reloading) {
      await context.reloading
    }

    isReloadPending = false
    context.reloadId++
    context.reloading = defer()

    let routesChanged = dirtyFiles.has(context.routesPath)
    let renderersChanged = dirtyFiles.has(context.renderPath)
    let clientEntriesChanged = dirtyClientModules.has(context.renderPath)
    dirtyFiles.clear()
    dirtyClientModules.clear()

    // Track which virtual modules need change events.
    const changesToEmit = new Set<string>()

    const { stateModuleBase } = context.app.config
    for (const { id } of dirtyStateModules) {
      const stateModuleIds = context.stateModulesByFile[id]
      clearCachedState(key => {
        const isMatch = stateModuleIds.some(
          moduleId => key == moduleId || key.startsWith(moduleId + '.')
        )
        if (isMatch) {
          changesToEmit.add(
            prependBase(stateModuleBase + key + '.js', context.basePath)
          )
        }
        return isMatch
      })
    }

    dirtyStateModules.clear()

    const cachedPages =
      routesChanged || renderersChanged ? await context.getCachedPages() : null!

    if (routesChanged) {
      try {
        context.logger.info(yellow('⨠ Reloading routes...'))
        await loadRoutes(context, resolveId)
        context.logger.info(green('✔︎ Routes are ready!'), { clear: true })

        // Reload the client-side routes map.
        changesToEmit.add('/@fs' + path.join(clientDir, 'routes.ts'))

        // Emit change events for page state modules.
        for (const [pagePath] of cachedPages)
          changesToEmit.add(
            '/' + getPageFilename(pagePath, context.basePath) + '.js'
          )
      } catch (error: any) {
        routesChanged = false
        events.emit('error', error)
      }
    }

    // Reload the renderers immediately, so the dev server is up-to-date
    // when new HTTP requests come in.
    if (renderersChanged) {
      try {
        context.logger.info(yellow('⨠ Reloading renderers...'))
        await loadRenderers(context)
        context.logger.info(green('✔︎ Renderers are ready!'), { clear: true })

        const oldConfigHooks = context.configHooks
        const newConfigHooks = await loadConfigHooks(config)

        const oldConfigPaths = oldConfigHooks.map(ref => ref.path)
        const newConfigPaths = newConfigHooks.map(ref => ref.path)

        // Were the imports of any config providers added or removed?
        const needsRestart =
          oldConfigPaths.some(file => !newConfigPaths.includes(file)) ||
          newConfigPaths.some(file => !oldConfigPaths.includes(file))

        if (needsRestart) {
          return events.emit('restart')
        }

        if (clientEntriesChanged)
          for (const [, [page]] of cachedPages) {
            if (page?.client) {
              // Ensure client entry modules are updated.
              changesToEmit.add('\0' + getClientUrl(page.client.id, '/'))
            }
          }
      } catch (error: any) {
        renderersChanged = false
        events.emit('error', error)
      }
    }

    if (routesChanged || renderersChanged) {
      context.clearCachedPages()
      await resetDevApp()
    }

    for (const file of changesToEmit) {
      watcher.emit('change', file)
    }

    context.reloading.resolve()
    context.reloading = undefined

    const reloadedPages = Array.from(failedRequests, req => req.path)
    failedRequests.clear()
    reloadedPages.forEach(pagePath => {
      server.ws?.send({
        type: 'full-reload',
        path: pagePath,
      })
    })
  }, 50)

  context.hotReload = async file => {
    if (dirtyFiles.has(file)) {
      return
    }
    const moduleMap = context.moduleMap
    const changedModule = moduleMap[file] || context.linkedModules[file]
    if (changedModule) {
      await moduleMap.__compileQueue
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
      scheduleReload()
    }
    // In the event of a syntax error, these modules won't exist in the module map,
    // but they still need to be reloaded on file change.
    else if (file == context.renderPath || file == context.routesPath) {
      dirtyFiles.add(file)
      scheduleReload()
    }
    // Restart the server when Vite config is changed.
    else if (file == context.configPath) {
      // Prevent handling by Vite.
      config.server.hmr = false
      // Skip SSR reloading by Saus.
      dirtyFiles.clear()

      debug(`Vite config changed. Restarting server.`)
      events.emit('restart')
    }
  }
}

function formatError(error: any, app: App) {
  let prelude = ''
  if (error.code == 'STATE_MODULE_404') {
    const moduleUrl = app.config.stateModuleBase + error.cacheKey + '.js'
    const inspectedArgs = inspect(error.args, {
      depth: 5,
      colors: true,
    })
    prelude =
      red(bold('Error: ')) +
      `The ${red(moduleUrl)} module was ` +
      `never loaded with the following arguments:\n` +
      inspectedArgs.replace(/(^|\n)/g, '$1  ') +
      `\n\n`
  }
  return '\n' + prelude + error.stack
}
