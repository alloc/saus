import * as vite from 'vite'
import path from 'path'
import { gray } from 'kleur'
import { klona } from 'klona'
import { EventEmitter } from 'events'
import { debounce } from 'ts-debounce'
import { addExitCallback, removeExitCallback } from 'catch-exit'
import {
  SausContext,
  loadContext,
  RenderModule,
  RoutesModule,
  resetConfigModules,
} from './core'
import { clientPlugin } from './plugins/client'
import { routesPlugin } from './plugins/routes'
import { servePlugin } from './plugins/serve'
import { renderPlugin } from './plugins/render'
import { setRenderModule, setRoutesModule } from './core/global'
import { steal } from './utils/steal'
import { defer } from './utils/defer'

export async function createServer(inlineConfig?: vite.UserConfig) {
  let context = await loadContext('serve', inlineConfig)

  const events = new EventEmitter()
  events.on('error', onError)
  events.on('restart', restart)

  let server: vite.ViteDevServer | null = null
  let serverPromise = startServer(context, events)
  serverPromise.then(s => (server = s))

  function restart() {
    serverPromise = serverPromise.then(async oldServer => {
      await oldServer?.close()

      resetConfigModules(context)
      context = await loadContext('serve', inlineConfig)
      server = await startServer(context, events, true)
      return server
    })
    serverPromise.catch(onError)
  }

  function onError(e: any) {
    const { logger } = context
    if (!logger.hasErrorLogged(e)) {
      server?.ssrRewriteStacktrace(e, context.config.filterStack)
      logger.error(e.stack, { error: e })
    }
  }

  const { logger } = context
  if (logger.isLogged('info')) {
    const server = await serverPromise
    if (server) {
      logger.info('')
      vite.printHttpServerUrls(server.httpServer!, server.config)
    }
  }

  const onExit = addExitCallback((signal, exitCode, error) => {
    if (error) {
      server?.ssrRewriteStacktrace(error, context.config.filterStack)
    }
  })

  return {
    restart,
    async close() {
      events.emit('close')
      try {
        const server = await serverPromise
        await server?.close()
      } catch (e) {
        onError(e)
      } finally {
        removeExitCallback(onExit)
      }
    },
  }
}

async function startServer(
  context: SausContext,
  events: EventEmitter,
  isRestart?: boolean
) {
  let { config } = context

  // Clone the config, but not its plugins.
  const plugins = steal(config, 'plugins')
  config = klona(config)
  config.plugins = plugins

  // Prepend the Saus dev plugins.
  config = vite.mergeConfig(
    <vite.UserConfig>{
      plugins: [
        servePlugin(context),
        clientPlugin(context),
        routesPlugin(context),
        renderPlugin(context),
      ],
    },
    config
  )

  const server = await vite.createServer(config)
  const watcher = server.watcher!

  // Listen immediately to ensure `buildStart` hook is called.
  await listen(server, events, isRestart)

  // Ensure the Vite config is watched.
  if (context.configPath) {
    watcher.add(context.configPath)
  }

  const moduleCache = (context.ssrContext = vite.ssrCreateContext(server))

  // When starting the server, the context is fresh, so we don't bother
  // using intermediate objects when loading routes and renderers.
  setRoutesModule(context)
  setRenderModule(context)
  try {
    await server.ssrLoadModule(
      [context.routesPath, context.renderPath].map(file =>
        file.replace(context.root, '')
      ),
      moduleCache
    )
  } catch (error) {
    // Handle parsing errors from Babel
    if (error instanceof SyntaxError) {
      const { id } = error as any
      if (id) {
        context.logger.error(error.message + '\n', { error })
        waitForChanges(id, server, events, () => {
          events.emit('restart')
        })
        return null
      }
    }
    throw error
  } finally {
    setRoutesModule(null)
    setRenderModule(null)
  }

  // Tell plugins to update local state derived from Saus context.
  emitContextUpdate(server, context)

  moduleCache.plugins.push(handleContextUpdates(context, server, events))

  const changedFiles = new Set<string>()
  const scheduleReload = debounce(async () => {
    // Restart the server when Vite config is changed.
    if (changedFiles.has(context.configPath!)) {
      return events.emit('restart')
    }

    // Wait for reloading to finish.
    while (context.reloading) {
      await context.reloading
    }

    if (!changedFiles.size) return
    const files = Array.from(changedFiles)
    changedFiles.clear()

    await moduleCache.reload(files)
  }, 50)

  watcher.on('change', file => {
    changedFiles.add(file)
    scheduleReload()
  })

  return server
}

function emitContextUpdate(server: vite.ViteDevServer, context: SausContext) {
  for (const plugin of server.config.plugins)
    hasContextUpdateHook(plugin) && plugin.contextUpdate(context)
}

function hasContextUpdateHook(
  plugin: any
): plugin is { contextUpdate: (context: SausContext) => void } {
  return !!plugin.contextUpdate
}

function handleContextUpdates(
  context: SausContext,
  server: vite.ViteDevServer,
  events: EventEmitter
): vite.SSRPlugin {
  let renderConfig: RenderModule | null
  let routesConfig: RoutesModule | null
  return {
    executeModule(module) {
      if (module.file === context.renderPath) {
        renderConfig = setRenderModule({ renderers: [], configHooks: [] })
      } else if (module.file === context.routesPath) {
        routesConfig = setRoutesModule({ routes: [] })
      } else {
        return // Not a module we care about.
      }
      context.reloading ??= defer()
      return error => {
        if (module.file === context.renderPath) {
          setRenderModule(null)
          if (error) {
            renderConfig = null
          }
        } else if (module.file === context.routesPath) {
          setRoutesModule(null)
          if (error) {
            routesConfig = null
          }
        }
      }
    },
    async loadedEntries(entries) {
      let isContextUpdated = false

      const renderModule = entries.find(mod => mod.file == context.renderPath)
      if (renderModule && renderConfig) {
        const oldProviders = context.configHooks.map(hook => hook.modulePath)
        const newProviders = renderConfig.configHooks.map(
          hook => hook.modulePath
        )

        // Check the imported modules of the renderModule to see if any
        // old config providers are still imported. This is necessary,
        // because SSR externals won't be re-executed by Vite.
        for (const dep of renderModule.transformResult.deps!) {
          const [, file] = await server.moduleGraph.resolveUrl(dep)
          if (oldProviders.includes(file)) {
            newProviders.push(file)
          }
        }

        // Were the imports of any config providers added or removed?
        const needsRestart =
          oldProviders.some(file => file && !newProviders.includes(file)) ||
          newProviders.some(file => file && !oldProviders.includes(file))

        if (needsRestart) {
          return events.emit('restart')
        }

        // No config hooks were added or removed.
        renderConfig.configHooks = context.configHooks

        // Merge the latest renderers.
        Object.assign(context, renderConfig)
        isContextUpdated = true
        renderConfig = null
      }

      // Merge the latest routes.
      if (routesConfig) {
        Object.assign(context, routesConfig)
        isContextUpdated = true
        routesConfig = null
      }

      if (isContextUpdated) {
        // Delete all keys, so the `pages` property can be
        // destructured into a local variable somewhere.
        Object.keys(context.pages).forEach(key => {
          delete context.pages[key]
        })

        // Update plugins that rely on Saus context.
        emitContextUpdate(server, context)
      }

      // Allow another reload to commence.
      context.reloading?.resolve()
      context.reloading = undefined
    },
  }
}

function listen(
  server: vite.ViteDevServer,
  events: EventEmitter,
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
  events: EventEmitter,
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

  logger.info(gray('Waiting for changes...'))
}
