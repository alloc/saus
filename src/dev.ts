import { addExitCallback, removeExitCallback } from 'catch-exit'
import { EventEmitter } from 'events'
import http from 'http'
import { gray } from 'kleur/colors'
import path from 'path'
import { StrictEventEmitter } from 'strict-event-emitter-types'
import { debounce } from 'ts-debounce'
import * as vite from 'vite'
import {
  extractClientFunctions,
  getPageFilename,
  RuntimeConfig,
  SausContext,
} from './core'
import { loadContext } from './core/context'
import { debug } from './core/debug'
import { getRequireFunctions } from './core/getRequireFunctions'
import { getSausPlugins } from './core/getSausPlugins'
import { loadConfigHooks } from './core/loadConfigHooks'
import { loadRenderers } from './core/loadRenderers'
import { loadRoutes } from './core/loadRoutes'
import { clientDir, globalCachePath, runtimeDir } from './core/paths'
import { createRenderPageFn } from './pages/renderPage'
import { createServePageFn } from './pages/servePage'
import { defineClientContext } from './plugins/clientContext'
import { serveClientEntries, getClientUrl } from './plugins/clientEntries'
import { transformClientState } from './plugins/clientState'
import { moduleRedirection, redirectModule } from './plugins/moduleRedirection'
import { renderPlugin } from './plugins/render'
import { routesPlugin } from './plugins/routes'
import { servePlugin } from './plugins/serve'
import { clearCachedState } from './runtime/clearCachedState'
import { stateModuleBase } from './runtime/constants'
import { defer } from './utils/defer'
import { prependBase } from './utils/prependBase'
import { formatAsyncStack } from './vm/formatAsyncStack'
import { purgeModule, resetModuleAndImporters } from './vm/moduleMap'
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
    loadContext('serve', inlineConfig, [
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
      logger.error('\n' + error.stack, { error })
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
  context: SausContext,
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

  const resolveId: ResolveIdHook = async (id, importer) =>
    await server.pluginContainer
      .resolveId(id, importer!, { ssr: true })
      .then(resolved => resolved?.id)

  context.server = server
  server.moduleMap = moduleMap
  server.linkedModules = {}
  Object.assign(server, getRequireFunctions(context, resolveId))
  context.ssrRequire = server.ssrRequire

  try {
    await loadRoutes(context, resolveId)
    await loadRenderers(context)
  } catch (error: any) {
    // Babel errors use `.id` and Saus VM uses `.file`
    const filename = error.id || error.file
    if (filename) {
      events.emit('error', error)
      waitForChanges(filename, server, events, async () => {
        await server.close().catch(e => events.emit('error', e))
        events.emit('restart')
      })
      return null
    }
    throw error
  }

  // This runs on server startup and whenever the routes and/or
  // renderers are reloaded.
  async function onContextUpdate() {
    const runtimeConfig: RuntimeConfig = {
      assetsDir: config.build.assetsDir,
      base: context.basePath,
      command: 'dev',
      defaultPath: context.defaultPath,
      htmlTimeout: config.saus.htmlTimeout,
      minify: false,
      mode: config.mode,
      publicDir: config.publicDir,
      ssrRoutesId: '/@fs/' + context.routesPath,
      stateCacheId: '/@fs/' + globalCachePath,
    }
    server.renderPage = createRenderPageFn(
      context,
      extractClientFunctions(context.renderPath),
      runtimeConfig,
      undefined,
      e => events.emit('error', e)
    )
    server.servePage = createServePageFn(context, runtimeConfig)
    context.plugins = await getSausPlugins(context)
  }

  await onContextUpdate()

  const dirtyFiles = new Set<string>()
  const dirtyStateModules = new Set<CompiledModule>()

  const scheduleReload = debounce(async () => {
    // Wait for reloading to finish.
    while (context.reloading) {
      await context.reloading
    }

    context.reloadId++
    context.reloading = defer()

    let routesChanged = dirtyFiles.has(context.routesPath)
    let renderersChanged = dirtyFiles.has(context.renderPath)
    dirtyFiles.clear()

    // Track which virtual modules need change events.
    const changesToEmit = new Set<string>()

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

    if (routesChanged) {
      try {
        await loadRoutes(context, resolveId)

        // Reload the client-side routes map.
        changesToEmit.add('/@fs' + path.join(clientDir, 'routes.ts'))

        // Emit change events for page state modules.
        for (const page of await context.getCachedPages())
          changesToEmit.add(
            '/' + getPageFilename(page.path, context.basePath) + '.js'
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
        await loadRenderers(context)

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

        const pages = await context.getCachedPages()
        for (const page of pages) {
          if (page.client) {
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
      await onContextUpdate()
    }

    for (const file of changesToEmit) {
      watcher.emit('change', file)
    }

    context.reloading.resolve()
    context.reloading = undefined
  }, 50)

  watcher.prependListener('change', async file => {
    if (dirtyFiles.has(file)) {
      return
    }
    const changedModule = moduleMap[file] || server.linkedModules[file]
    if (changedModule) {
      await moduleMap.__compileQueue
      const stateModules = new Set(
        Object.keys(context.stateModulesByFile).map(file => moduleMap[file]!)
      )
      const resetStateModule = (module: CompiledModule | LinkedModule) => {
        if (isLinkedModule(module)) return

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
        resetModuleAndImporters(changedModule, dirtyFiles, resetStateModule)
      } else {
        purgeModule(changedModule, dirtyFiles, resetStateModule)
      }
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
  })

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
