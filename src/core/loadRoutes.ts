import * as esModuleLexer from 'es-module-lexer'
import { klona } from 'klona'
import MagicString from 'magic-string'
import path from 'path'
import { SausContext } from './context'
import { debug } from './debug'
import { setRoutesModule } from './global'
import { injectServerModules } from './injectModules'
import { servedPathForFile } from './node/servedPathForFile'
import { createModuleProvider } from './plugins/moduleProvider'
import { renderRouteClients } from './routeClients'
import { getRouteRenderers } from './routeRenderer'
import { callPlugins } from './utils/callPlugins'
import { serializeImports } from './utils/imports'
import { compileNodeModule } from './vite/compileNodeModule'
import { executeModule } from './vm/executeModule'
import { formatAsyncStack } from './vm/formatAsyncStack'
import { registerModuleOnceCompiled } from './vm/moduleMap'
import { injectNodeModule } from './vm/nodeModules'
import { RequireAsync } from './vm/types'

export async function loadRoutes(
  context: SausContext,
  transformClient?: (code: string) => string
) {
  const time = Date.now()

  const routesModule =
    context.moduleMap[context.routesPath] ||
    (await compileRoutesModule(context, (id, importer, isDynamic) =>
      // Dynamic imports are assumed to *not* be Node.js modules
      context[isDynamic ? 'ssrRequire' : 'require'](id, importer, isDynamic)
    ))

  const routesConfig = setRoutesModule({
    catchRoute: undefined,
    defaultRoute: undefined,
    defaultState: [],
    htmlProcessors: undefined,
    layoutEntries: new Set(),
    requestHooks: undefined,
    responseHooks: undefined,
    routes: [],
    runtimeHooks: [],
    ssrRequire: context.ssrRequire,
  })
  try {
    await executeModule(routesModule)

    // Exclude the routes module from its package, or else it
    // will have its modules cleared when it shouldn't.
    routesModule.package?.delete(routesModule)
    routesModule.package = undefined

    // Resolve route modules of generated routes to ensure they exist.
    for (const route of routesConfig.routes) {
      if (!route.moduleId || !route.generated) {
        continue
      }
      let resolved = await context.resolveId(route.moduleId, route.file)
      if (!resolved) {
        const error = Error(`Cannot find module "${route.moduleId}"`)
        throw Object.assign(error, {
          code: 'ERR_MODULE_NOT_FOUND',
          importer: route.file,
        })
      }
      route.moduleId = servedPathForFile(resolved.id, context.root)
    }

    Object.assign(context, routesConfig)
    context.renderers = await getRouteRenderers(context)
    context.routeClients = renderRouteClients(context, transformClient)
    injectClientRoutes(context)

    debug(`Loaded the routes module in ${Date.now() - time}ms`)
  } catch (error: any) {
    formatAsyncStack(error, context.moduleMap, [], context.config.filterStack)
    throw error
  } finally {
    setRoutesModule(null)
  }

  await callPlugins(context.plugins, 'receiveRoutes', context)
}

async function compileRoutesModule(
  context: SausContext,
  requireAsync: RequireAsync
) {
  const { resolveId, routesPath, root } = context

  // Injections made with the `injectModules` plugin API are
  // reloaded whenever the routes module is, while injections
  // made through the `context` object are reused.
  const injectedImports = klona(context.injectedImports)
  const injectedModules = createModuleProvider({
    serverModules: new Map(context.injectedModules.serverModules),
    watcher: context.watcher,
  })

  await injectServerModules(context, injectedModules, injectedImports)

  const loadResult = await context.load(context.routesPath)
  if (!loadResult) {
    throw Error(`Cannot find routes module "${routesPath}"`)
  }

  const code = loadResult.code
  const editor = new MagicString(code)

  if (injectedImports.prepend.length) {
    editor.prepend(serializeImports(injectedImports.prepend).join('\n') + '\n')
  }
  if (injectedImports.append.length) {
    editor.append(serializeImports(injectedImports.append).join('\n') + '\n')
  }

  // Import specifiers for route modules need to be rewritten
  // as dev URLs for them to be imported properly by the browser.
  for (const imp of esModuleLexer.parse(code)[0]) {
    if (imp.d >= 0 && imp.n) {
      let resolved = await resolveId(imp.n, routesPath)
      if (resolved) {
        if (typeof resolved == 'string') {
          resolved = { id: resolved }
        }

        const resolvedUrl = resolved.external
          ? resolved.id
          : resolved.id.startsWith(root + '/')
          ? resolved.id.slice(root.length)
          : '/@fs/' + resolved.id

        editor.overwrite(imp.s, imp.e, `"${resolvedUrl}"`)
      }
    }
  }

  return registerModuleOnceCompiled(
    context.moduleMap,
    compileNodeModule(editor.toString(), routesPath, requireAsync, context)
  )
}

/**
 * This injects the `routes` object exported by `saus/client`.
 */
function injectClientRoutes(context: SausContext) {
  const clientRoutes: Record<string, string> = {}
  for (const { fileName, routes } of context.renderers) {
    const clientId = '\0client/' + fileName
    const client = context.routeClients.clientsById[clientId]!
    for (const route of routes) {
      clientRoutes[route.path] = client.url
    }
  }

  const modulePath = path.resolve(__dirname, '../client/routes.cjs')
  injectNodeModule(modulePath, clientRoutes)

  if (context.command == 'serve') {
    // Do nothing if already registered.
    if (!context.liveModulePaths.has(modulePath)) {
      context.liveModulePaths.add(modulePath)

      // Eagerly invalidate our importers when the routes module
      // is changed, thereby merging the two reload passes.
      context.watcher.on('change', file => {
        if (file === context.routesPath) {
          context.hotReload(modulePath, true)
        }
      })
    }
  }
}
