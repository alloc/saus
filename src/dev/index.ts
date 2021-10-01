import * as vite from 'vite'
import { klona } from 'klona'
import { debounce } from 'ts-debounce'
import { loadContext, loadModule, resetRenderHooks, Context } from '../context'
import { clientPlugin } from '../plugins/client'
import { renderPlugin } from '../plugins/render'
import { routesPlugin } from '../plugins/routes'

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
        return startServer(context, restart, onError, oldServer?.moduleGraph)
      })
      .catch(onError)
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
  context: Context,
  restart: () => void,
  onError: (e: any) => void,
  moduleGraph?: vite.ModuleGraph
) {
  await loadConfigHooks(context, moduleGraph)

  const config = vite.mergeConfig(klona(context.config), <vite.UserConfig>{
    configFile: false,
    plugins: [
      renderPlugin(context), // SSR renderer
      clientPlugin(context), // Client hydration
      routesPlugin(context), // Routes module
    ],
  })

  context.configHooks.forEach(hook => {
    hook(config, context)
  })

  const server = await vite.createServer(config)
  await server.listen(undefined, !!moduleGraph)

  context.routes = []
  await loadRoutes(context, server.ssrLoadModule)

  resetRenderHooks(context)
  await loadRenderHooks(context, server.ssrLoadModule)

  emitContextUpdate(server, context)

  const contextPaths = [context.renderPath, context.routesPath]
  const renderModule = server.moduleGraph.getModuleById(context.renderPath)!

  server.watcher.add(contextPaths)
  server.watcher.on(
    'change',
    debounce(file => {
      if (file === context.renderPath || isImportedBy(file, renderModule)) {
        resetRenderHooks(context, true)
        return (
          loadRenderHooks(context, server.ssrLoadModule)
            // Restart if a config hook is added.
            .then(() =>
              context.configHooks.length
                ? restart()
                : emitContextUpdate(server, context)
            )
            .catch(onError)
        )
      }
      if (file === context.routesPath) {
        context.routes = []
        return loadRoutes(context, server.ssrLoadModule)
          .then(() => emitContextUpdate(server, context))
          .catch(onError)
      }
    }, 100)
  )

  return server
}

function loadRoutes(context: Context, load: (url: string) => Promise<any>) {
  return loadModule(context.routesPath, context, load)
}

function loadRenderHooks(
  context: Context,
  load: (url: string) => Promise<any>
) {
  return loadModule(context.renderPath, context, load)
}

async function loadConfigHooks(
  context: Context,
  moduleGraph?: vite.ModuleGraph
) {
  const loader = await vite.createServer({
    ...context.config,
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: 'ssr' },
  })
  if (moduleGraph) {
    // Avoid re-evaluating unchanged modules.
    loader.moduleGraph.idToModuleMap = moduleGraph.idToModuleMap
    loader.moduleGraph.urlToModuleMap = moduleGraph.urlToModuleMap
    loader.moduleGraph.fileToModulesMap = moduleGraph.fileToModulesMap

    // Ensure the render module is re-evaluated.
    const renderModule = moduleGraph.getModuleById(context.renderPath)!
    moduleGraph.invalidateModule(renderModule)
  }
  context.configHooks = []
  await loadRenderHooks(context, loader.ssrLoadModule)
  await loader.close()
}

function isImportedBy(
  file: string,
  mod: vite.ModuleNode,
  seen = new Set<vite.ModuleNode>()
) {
  seen.add(mod)
  for (const dep of mod.importedModules) {
    if (dep.id === file) {
      return true
    }
    if (!seen.has(dep) && isImportedBy(file, dep, seen)) {
      return true
    }
  }
  return false
}

function emitContextUpdate(server: vite.ViteDevServer, context: Context) {
  for (const plugin of server.config.plugins)
    hasContextUpdateHook(plugin) && plugin.contextUpdate(context)
}

function hasContextUpdateHook(
  plugin: any
): plugin is { contextUpdate: (context: Context) => void } {
  return !!plugin.contextUpdate
}
