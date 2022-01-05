import { addExitCallback, removeExitCallback } from 'catch-exit'
import { EventEmitter } from 'events'
import kleur from 'kleur'
import { klona } from 'klona'
import path from 'path'
import { debounce } from 'ts-debounce'
import * as vite from 'vite'
import { RenderModule, RoutesModule, SausContext } from './core'
import { loadConfigHooks, loadContext } from './core/context'
import { debug } from './core/debug'
import { setRenderModule, setRoutesModule } from './core/global'
import { clientPlugin } from './plugins/client'
import { transformClientState } from './plugins/clientState'
import { renderPlugin } from './plugins/render'
import { routesPlugin } from './plugins/routes'
import { servePlugin } from './plugins/serve'
import { defer } from './utils/defer'
import { steal } from './utils/steal'

export async function createServer(inlineConfig?: vite.UserConfig) {
  let context = await loadContext('serve', inlineConfig)

  const events = new EventEmitter()
  events.on('error', onError)
  events.on('restart', restart)

  let server: vite.ViteDevServer | null = null
  let serverPromise = startServer(context, events)

  // Stop promises from crashing the process.
  process.on('unhandledRejection', onError)

  function restart() {
    serverPromise = serverPromise.then(async oldServer => {
      await oldServer?.close()

      context.logger.clearScreen('info')
      context = await loadContext('serve', inlineConfig)
      server = await startServer(context, events, true)
      return server
    })
    serverPromise.catch(onError)
  }

  function onError(error: any) {
    const { logger } = context
    if (!logger.hasErrorLogged(error)) {
      server?.ssrRewriteStacktrace(error, context.config.filterStack)
      const msg = error instanceof SyntaxError ? error.message : error.stack
      logger.error(msg, { error })
    }
  }

  server = await serverPromise

  const onExit = addExitCallback((signal, exitCode, error) => {
    if (error) {
      server?.ssrRewriteStacktrace(error, context.config.filterStack)
    }
  })

  return {
    restart,
    async close() {
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
        servePlugin(context, e => events.emit('error', e)),
        clientPlugin(context),
        routesPlugin(context),
        renderPlugin(context),
        transformClientState(),
      ],
    },
    config
  ) as any

  const server = await vite.createServer(config)
  const watcher = server.watcher!

  // Listen immediately to ensure `buildStart` hook is called.
  await listen(server, events, isRestart)

  if (context.logger.isLogged('info')) {
    context.logger.info('')
    server.printUrls()
    server.bindShortcuts()
  }

  // Ensure the Vite config is watched.
  if (context.configPath) {
    watcher.add(context.configPath)
  }

  const moduleCache = (context.ssrContext = vite.ssrCreateContext(server, [
    injectDevCache(context),
  ]))

  const loadSausModules = () =>
    server.ssrLoadModule(
      [context.routesPath, context.renderPath].map(file =>
        file.replace(context.root, '')
      ),
      moduleCache
    )

  // When starting the server, the context is fresh, so we don't bother
  // using intermediate objects when loading routes and renderers.
  setRoutesModule(context)
  setRenderModule(context)
  try {
    await loadSausModules()
  } catch (error: any) {
    // Babel errors use `.id` and Vite SSR uses `.file`
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
  } finally {
    setRoutesModule(null)
    setRenderModule(null)
  }

  // Tell plugins to update local state derived from Saus context.
  emitContextUpdate(context)

  // This plugin handles updated modules, so it's not needed until
  // the server has been initialized.
  moduleCache.plugins.push(handleContextUpdates(context, server, events))

  const changedFiles = new Set<string>()
  const scheduleReload = debounce(async () => {
    // Restart the server when Vite config is changed.
    if (changedFiles.has(context.configPath!)) {
      debug(`Vite config changed. Restarting server.`)
      return events.emit('restart')
    }

    // Wait for reloading to finish.
    while (context.reloading) {
      await context.reloading
    }

    if (!changedFiles.size) return
    const files = Array.from(changedFiles)
    changedFiles.clear()

    context.reloadId++
    context.reloading = defer()

    const purged = await moduleCache.purge(files).catch(error => {
      // Clone the error so unfixed Babel errors never go unnoticed.
      events.emit('error', cloneError(error))
    })

    // Reload the "render.ts" and "routes.ts" modules immediately,
    // so the dev server is up-to-date when new HTTP requests come in.
    const needsReload = !!purged?.some(
      mod => mod.file == context.renderPath || mod.file == context.routesPath
    )

    if (needsReload) {
      await loadSausModules()
    } else {
      context.reloading?.resolve()
      context.reloading = undefined
    }
  }, 50)

  watcher.on('change', file => {
    changedFiles.add(file)
    scheduleReload()
  })

  return server
}

/**
 * We want `loadClientState` to "just work" in SSR environments,
 * so we need to inject the state cache by overriding the import
 * made within the `src/client/state.ts` module.
 */
function injectDevCache(context: SausContext): vite.SSRPlugin {
  const cachePath = '/@fs' + path.resolve(__dirname, '../src/client/cache.ts')
  return {
    setExports(id) {
      if (id == cachePath) {
        return { states: context.states }
      }
    },
  }
}

function emitContextUpdate(context: SausContext) {
  for (const plugin of context.plugins) {
    plugin.onContext?.(context)
  }
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
        renderConfig = setRenderModule({
          renderers: [],
          beforeRenderHooks: [],
        })
      } else if (module.file === context.routesPath) {
        routesConfig = setRoutesModule({
          routes: [],
          runtimeHooks: [],
        })
      } else {
        return // Not a module we care about.
      }
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
        const newConfigHooks = await loadConfigHooks(context.renderPath)
        const oldConfigHooks = context.configHooks

        // Were the imports of any config providers added or removed?
        const needsRestart =
          oldConfigHooks.some(file => file && !newConfigHooks.includes(file)) ||
          newConfigHooks.some(file => file && !oldConfigHooks.includes(file))

        if (needsRestart) {
          return events.emit('restart')
        }

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
        emitContextUpdate(context)
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

  logger.info(kleur.gray('Waiting for changes...'))
}

function cloneError(e: any) {
  const clone = Object.assign(new e.constructor(), e)
  clone.message = e.message
  clone.stack = e.stack
  return clone
}
