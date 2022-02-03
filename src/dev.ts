import { addExitCallback, removeExitCallback } from 'catch-exit'
import { EventEmitter } from 'events'
import { gray, red } from 'kleur/colors'
import path from 'path'
import { debounce } from 'ts-debounce'
import * as vite from 'vite'
import { loadRoutes, SausContext } from './core'
import { loadConfigHooks, loadContext } from './core/context'
import { debug } from './core/debug'
import { loadRenderers } from './core/loadRenderers'
import { clientDir, runtimeDir } from './core/paths'
import { clientPlugin } from './plugins/client'
import { transformClientState } from './plugins/clientState'
import { moduleRedirection, redirectModule } from './plugins/moduleRedirection'
import { renderPlugin } from './plugins/render'
import { routesPlugin } from './plugins/routes'
import { servePlugin } from './plugins/serve'
import { clearState } from './runtime/clearState'
import { callPlugins } from './utils/callPlugins'
import { defer } from './utils/defer'
import { formatAsyncStack } from './vm/formatAsyncStack'
import { CompiledModule, ModuleMap, ResolveIdHook } from './vm/types'

export async function createServer(inlineConfig?: vite.UserConfig) {
  const events = new EventEmitter()
  const createContext = () =>
    loadContext('serve', inlineConfig, [
      servePlugin(e => events.emit('error', e)),
      clientPlugin,
      config => routesPlugin(config),
      renderPlugin,
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
      await oldServer?.close()

      context.logger.clearScreen('info')
      context = await createContext()
      server = await startServer(context, (moduleMap = {}), events, true)
      return server
    })
    serverPromise.catch(onError)
  }

  function onError(error: any) {
    const { logger } = context
    if (!logger.hasErrorLogged(error)) {
      formatAsyncStack(error, moduleMap, [], context.config.filterStack)
      logger.error(error.stack, { error })
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
  moduleMap: ModuleMap,
  events: EventEmitter,
  isRestart?: boolean
) {
  const server = await vite.createServer(context.config)
  const watcher = server.watcher!

  // Listen immediately to ensure `buildStart` hook is called.
  await listen(server, events, isRestart)

  if (context.logger.isLogged('info')) {
    context.logger.info('')
    server.printUrls()
    server.bindShortcuts()
    context.logger.info('')
  }

  // Ensure the Vite config is watched.
  if (context.configPath) {
    watcher.add(context.configPath)
  }

  // The module cache prevents SSR modules from being re-executed
  // between calls to ssrLoadModule unless they (or a dependency
  // of theirs) have changed.
  const moduleCache = vite.ssrCreateContext(server, [overrideStateModules()])

  const resolveId: ResolveIdHook = async (id, importer) => {
    const resolved = await server.pluginContainer.resolveId(
      id,
      importer,
      undefined,
      true
    )
    return resolved?.id
  }

  context.server = server
  try {
    await loadRoutes(context, { moduleMap, resolveId })
    await loadRenderers(context, { moduleMap, resolveId })
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
  }

  // Tell plugins to update local state derived from Saus context.
  await callPlugins(context.plugins, 'onContext', context)

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

    context.reloadId++
    context.reloading = defer()

    let routesChanged = false
    let renderersChanged = false

    if (changedFiles.has(context.routesPath)) {
      try {
        await loadRoutes(context, { moduleMap, resolveId })
        routesChanged = true
      } catch (error: any) {
        events.emit('error', error)
      } finally {
        changedFiles.delete(context.routesPath)
      }
    }

    if (changedFiles.size) {
      const files = Array.from(changedFiles)
      changedFiles.clear()

      // Remove cached state defined by the changed files.
      for (const file of files) {
        const stateModuleIds = context.stateModulesByFile[file]
        if (stateModuleIds) {
          // State modules use the global cache.
          clearState(key => {
            return stateModuleIds.some(id => key.startsWith(id + '.'))
          })
        }
      }

      const purged = await moduleCache.purge(files).catch(error => {
        // Clone the error so unfixed Babel errors never go unnoticed.
        events.emit('error', cloneError(error))
      })

      // Reload the renderers immediately, so the dev server is up-to-date
      // when new HTTP requests come in.
      if (purged?.some(mod => mod.file == context.renderPath)) {
        try {
          await loadRenderers(context, { moduleMap, resolveId })
          renderersChanged = true

          const oldConfigHooks = context.configHooks
          const newConfigHooks = await loadConfigHooks(
            context.renderPath,
            oldConfigHooks
          )

          const oldConfigPaths = oldConfigHooks.map(ref => ref.path)
          const newConfigPaths = newConfigHooks.map(ref => ref.path)

          // Were the imports of any config providers added or removed?
          const needsRestart =
            oldConfigPaths.some(file => !newConfigPaths.includes(file)) ||
            newConfigPaths.some(file => !oldConfigPaths.includes(file))

          if (needsRestart) {
            return events.emit('restart')
          }
        } catch (error: any) {
          events.emit('error', error)
        }
      }
    }

    if (routesChanged || renderersChanged) {
      context.clearCachedPages()
      await callPlugins(context.plugins, 'onContext', context)
    }

    context.reloading.resolve()
    context.reloading = undefined
  }, 50)

  const purgeModuleMap = ({ id, importers }: CompiledModule) => {
    if (!changedFiles.has(id)) {
      changedFiles.add(id)
      delete moduleMap[id]
      for (const importer of importers) {
        purgeModuleMap(importer)
      }
    }
  }

  watcher.prependListener('change', file => {
    const module = moduleMap[file]
    if (module) {
      purgeModuleMap(module)
      scheduleReload()
    }
  })

  return server
}

/**
 * Ensure modules compiled by `loadRoutes` and modules loaded by Vite SSR
 * both use the same instance of the `defineStateModule` function.
 */
function overrideStateModules(): vite.SSRPlugin {
  const stateModulesPath = path.join(runtimeDir, 'stateModules.ts')
  return {
    setExports(id) {
      if (id == stateModulesPath) {
        return import('./runtime/stateModules')
      }
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

function cloneError(e: any) {
  const clone = Object.assign(new e.constructor(), e)
  clone.message = e.message
  clone.stack = e.stack
  return clone
}
