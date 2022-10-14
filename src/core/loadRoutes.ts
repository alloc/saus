import { upsertPlugin } from '@/vite/upsertPlugin'
import { toDebugPath } from '@utils/node/toDebugPath'
import { noop } from '@utils/noop'
import { debug as vmDebug } from '@vm/debug'
import { executeModule } from '@vm/executeModule'
import { formatAsyncStack } from '@vm/formatAsyncStack'
import { injectNodeModule } from '@vm/nodeModules'
import { isLinkedModule, RequireAsync } from '@vm/types'
import * as esModuleLexer from 'es-module-lexer'
import kleur from 'kleur'
import MagicString from 'magic-string'
import { startTask } from 'misty/task'
import path from 'path'
import { SausContext, SausEventEmitter } from './context'
import { debug } from './debug'
import { getClientInjection, getServerInjection } from './injectModules'
import { servedPathForFile } from './node/servedPathForFile'
import { renderRouteClients } from './routeClients'
import { getRouteRenderers } from './routeRenderer'
import { setRoutesModule } from './runtime/global'
import { callPlugins } from './utils/callPlugins'
import { compileNodeModule } from './vite/compileNodeModule'

export async function loadRoutes(context: SausContext) {
  const time = Date.now()
  const {
    plugins,
    filterStack,
    saus: { requireTimeout },
  } = context.config

  // Maybe not the best place for these, but the loadRoutes function
  // is used by both the dev and bundle commands, so it works well.
  const clientModules = await getClientInjection(context)
  const serverModules = await getServerInjection(context)
  upsertPlugin(plugins, clientModules.provider)
  upsertPlugin(plugins, serverModules.provider)

  const routesModule = await compileRoutesModule(
    context,
    serverModules.transform,
    (id, importer, isDynamic, framesToPop = 0, timeout) =>
      // Dynamic imports are assumed to *not* be Node.js modules
      context[isDynamic ? 'ssrRequire' : 'require'](
        id,
        importer,
        isDynamic,
        framesToPop + 1,
        timeout
      )
  )

  let moduleCount = 0
  let compileTimeSum = 0
  let requireTimeSum = 0
  let task = context.logger.isLogged('info')
    ? startTask(() => `${moduleCount} modules required.`)
    : null

  const events = context.events as SausEventEmitter
  events.on('require', (id, requireTime, module) => {
    module?.imports.forEach(module => {
      if (!isLinkedModule(module)) {
        requireTime -= module.requireTime
      }
    })
    moduleCount++
    requireTimeSum += requireTime
    if (module) {
      compileTimeSum += module.compileTime
    }
    task?.update()
    if (vmDebug.enabled) {
      if (module && module.compileTime > 500)
        vmDebug(
          `Compiled %s in %s`,
          kleur.cyan(toDebugPath(id)),
          prettySecs(module.compileTime)
        )
      if (requireTime > 500)
        vmDebug(
          `Loaded %s in %s`,
          kleur.cyan(toDebugPath(id)),
          prettySecs(requireTime)
        )
    }
  })

  const routesConfig = setRoutesModule({
    catchRoute: undefined,
    defaultRoute: undefined,
    defaultState: undefined,
    htmlProcessors: undefined,
    requestHooks: undefined,
    responseHooks: undefined,
    routes: [],
    runtimeHooks: [],
    ssrRequire: context.ssrRequire,
  })
  try {
    await executeModule(routesModule, requireTimeout)

    // Exclude the routes module from its package, or else it
    // will have its modules cleared when it shouldn't.
    routesModule.package?.delete(routesModule)
    routesModule.package = undefined

    // Resolve route modules of generated routes to ensure they exist.
    for (const route of routesConfig.routes) {
      let needsResolve = false
      let moduleId = route.moduleId!
      if (moduleId) {
        if (route.generated) {
          needsResolve = true
        } else if (/^\.\.?(\/|$)/.test(moduleId)) {
          needsResolve = true
          if (!route.file) {
            throw Error(
              `Route "${route.path}" has relative import but no filename`
            )
          }
        }
      }
      if (needsResolve) {
        const resolved = await context.resolveId(moduleId, route.file)
        if (!resolved) {
          const error = Error(`Cannot find module "${route.moduleId}"`)
          throw Object.assign(error, {
            code: 'ERR_MODULE_NOT_FOUND',
            importer: route.file,
          })
        }
        route.moduleId = servedPathForFile(resolved.id, context.root)
      }
    }

    Object.assign(context, routesConfig)
    context.renderers = await getRouteRenderers(context)
    context.routeClients = renderRouteClients(context, clientModules.transform)
    injectClientRoutes(context)

    debug(`Loaded the routes module in ${Date.now() - time}ms`)
  } catch (error: any) {
    formatAsyncStack(error, context.moduleMap, [], filterStack)
    throw error
  } finally {
    setRoutesModule(null)
    task?.finish(
      `${moduleCount} modules required.` +
        (moduleCount
          ? ` (requireMean = ${prettySecs(
              requireTimeSum / moduleCount
            )}, compileMean = ${prettySecs(compileTimeSum / moduleCount)})`
          : ``)
    )
  }

  await callPlugins(context.plugins, 'receiveRoutes', context)
}

function prettySecs(ms: number) {
  return (Math.floor(ms / 100) / 10).toFixed(2) + 's'
}

async function compileRoutesModule(
  context: SausContext,
  transform: (code: string) => string,
  requireAsync: RequireAsync
) {
  const { resolveId, routesPath, root } = context

  const loadResult = await context.load(context.routesPath)
  if (!loadResult) {
    throw Error(`Cannot find routes module "${routesPath}"`)
  }

  const code = transform(loadResult.code)
  const editor = new MagicString(code)

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

  return context.moduleMap.setPromise(
    routesPath,
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
          context.hotReload(modulePath, true).catch(noop)
        }
      })
    }
  }
}
