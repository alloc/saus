import * as vite from 'vite'
import { klona } from 'klona'
import { debounce } from 'ts-debounce'
import { SausContext, loadContext, RenderModule, RoutesModule } from './core'
import { clientPlugin } from './plugins/client'
import { routesPlugin } from './plugins/routes'
import { servePlugin } from './plugins/serve'
import { renderPlugin } from './plugins/render'
import { setRenderModule, setRoutesModule } from './core/global'
import { steal } from './utils/steal'
import { defer } from './utils/defer'

export async function createServer(inlineConfig?: vite.UserConfig) {
  let context = await loadContext('serve', inlineConfig)
  let serverPromise = startServer(context, restart, onError)

  function restart() {
    serverPromise = serverPromise.then(async oldServer => {
      await oldServer.close()
      context = await loadContext('serve', inlineConfig)
      return startServer(context, restart, onError, true)
    })
    serverPromise.catch(onError)
  }

  function onError(e: any) {
    const { logger } = context
    if (!logger.hasErrorLogged(e)) {
      logger.error(e.stack, { error: e })
    }
    return null
  }

  const { logger } = context
  if (logger.isLogged('info')) {
    logger.info('')
    const server = await serverPromise
    vite.printHttpServerUrls(server.httpServer!, server.config)
  }

  return {
    restart,
    close: () => serverPromise.then(server => server.close(), onError),
  }
}

async function startServer(
  context: SausContext,
  restart: () => void,
  onError: (e: any) => void,
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

  // Listen immediately to ensure `buildStart` hook is called.
  const server = await vite.createServer(config)
  await server.listen(undefined, isRestart)

  // Ensure the Vite config is watched.
  if (context.configPath) {
    server.watcher!.add(context.configPath)
  }

  context.ssrContext = vite.ssrCreateContext(server)

  // When starting the server, the context is fresh, so we don't bother
  // using intermediate objects when loading routes and renderers.
  setRoutesModule(context)
  setRenderModule(context)
  try {
    await server.ssrLoadModule(
      [context.routesPath, context.renderPath].map(file =>
        file.replace(context.root, '')
      ),
      context.ssrContext
    )
  } finally {
    setRoutesModule(null)
    setRenderModule(null)
  }

  // Tell plugins to update local state derived from Saus context.
  emitContextUpdate(server, context)

  context.ssrContext.plugins.push(
    handleContextUpdates(context, server, restart)
  )

  const changedFiles = new Set<string>()
  const scheduleReload = debounce(async () => {
    // Restart the server when Vite config is changed.
    if (changedFiles.has(context.configPath!)) {
      return restart()
    }

    // Wait for reloading to finish.
    while (context.reloading) {
      await context.reloading
    }

    if (!changedFiles.size) return
    const files = Array.from(changedFiles)
    changedFiles.clear()

    const cache = context.ssrContext!
    await cache.reload(files)
  }, 50)

  server.watcher!.on('change', file => {
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
  restart: () => void
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
          return restart()
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
