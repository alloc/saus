import * as vite from 'vite'
import { klona } from 'klona'
import { debounce } from 'ts-debounce'
import { watch } from 'chokidar'
import {
  SausContext,
  createLoader,
  loadConfigHooks,
  loadContext,
  loadRenderHooks,
  loadRoutes,
  resetRenderHooks,
} from './context'
import { clientPlugin } from './plugins/client'
import { routesPlugin } from './plugins/routes'
import { servePlugin } from './plugins/serve'
import { renderMetaPlugin } from './plugins/renderMeta'

export async function createServer(inlineConfig?: vite.UserConfig) {
  const root = inlineConfig?.root || process.cwd()
  const configEnv: vite.ConfigEnv = {
    command: 'serve',
    mode: inlineConfig?.mode || 'development',
  }

  const logLevel = inlineConfig?.logLevel || 'info'
  const context = await loadContext(root, configEnv, logLevel)

  if (inlineConfig)
    context.config = vite.mergeConfig(context.config, inlineConfig)

  const { logger } = context

  const onError = (e: any) => {
    if (!logger.hasErrorLogged(e)) {
      logger.error(e.message, { error: e })
    }
    return null
  }

  let serverPromise = startServer(context, restart, onError).catch(onError)

  function restart() {
    serverPromise = serverPromise
      .then(async oldServer => {
        await oldServer?.close()
        return startServer(context, restart, onError, true)
      })
      .catch(onError)
  }

  if (logger.isLogged('info')) {
    logger.info('')
    const server = (await serverPromise)!
    vite.printHttpServerUrls(server.httpServer!, server.config)
  }

  return {
    restart,
    close: () =>
      serverPromise.then(server => {
        server?.close()
      }),
  }
}

async function startServer(
  context: SausContext,
  restart: () => void,
  onError: (e: any) => void,
  isRestart?: boolean
) {
  const loader = await createLoader(context)
  await loadConfigHooks(context, loader)
  await loader.close()

  let config = klona(context.config)

  const contextPaths = [context.renderPath, context.routesPath]
  config = vite.mergeConfig(config, <vite.UserConfig>{
    configFile: false,
    plugins: [
      servePlugin(context), // Page renderer
      clientPlugin(context), // Client hydration
      routesPlugin(context), // Routes module
      renderMetaPlugin(context), // Render metadata
    ],
    server: {
      watch: {
        ignored: contextPaths,
      },
    },
  })

  context.configHooks.forEach(hook => {
    const result = hook(config, context)
    if (result) {
      config = vite.mergeConfig(config, result)
    }
  })

  // Listen immediately to ensure `buildStart` hook is called.
  const server = await vite.createServer(config)
  await server.listen(undefined, isRestart)

  // Load the routes after config hooks are applied.
  context.routes = []
  await loadRoutes(context, server)

  // Load the renderers after config hooks are applied.
  resetRenderHooks(context)
  await loadRenderHooks(context, server)

  // Tell plugins to update local state derived from Saus context.
  emitContextUpdate(server, context)

  // Watch our context paths, so routes and renderers are hot-updated.
  const watcher = watch(contextPaths).on(
    'change',
    debounce(file => {
      if (file === context.renderPath) {
        resetRenderHooks(context, true)
        return loadRenderHooks(context, server)
          .then(() => {
            // Restart if a config hook is added.
            if (context.configHooks.length) {
              return restart()
            }
            emitContextUpdate(server, context)
            server.watcher.emit('change', file)
          })
          .catch(onError)
      }
      if (file === context.routesPath) {
        context.routes = []
        return loadRoutes(context, server)
          .then(() => {
            emitContextUpdate(server, context)
            server.watcher.emit('change', file)
          })
          .catch(onError)
      }
    }, 30)
  )

  server.httpServer!.on('close', () => {
    console.log('httpServer.close')
    watcher.close()
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
