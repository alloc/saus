import * as esModuleLexer from 'es-module-lexer'
import fs from 'fs'
import MagicString from 'magic-string'
import path from 'path'
import { SausContext } from './context'
import { debug } from './debug'
import { getRequireFunctions } from './getRequireFunctions'
import { setRoutesModule } from './global'
import { relativeToCwd } from './node/relativeToCwd'
import { toDevPath } from './node/toDevPath'
import { Route } from './routes'
import { callPlugins } from './utils/callPlugins'
import { compileNodeModule } from './vm/compileNodeModule'
import { executeModule } from './vm/executeModule'
import { formatAsyncStack } from './vm/formatAsyncStack'
import { registerModuleOnceCompiled } from './vm/moduleMap'
import { injectNodeModule } from './vm/nodeModules'
import { ModuleMap, RequireAsync } from './vm/types'

export async function loadRoutes(
  context: Omit<SausContext, 'command'> & { command: string }
) {
  const time = Date.now()
  const moduleMap = context.moduleMap || {}

  const { require, ssrRequire } = (
    !context.ssrRequire && context.command == 'build'
      ? getRequireFunctions(context, moduleMap)
      : context
  ) as {
    require: RequireAsync
    ssrRequire: RequireAsync
  }

  const routesModule =
    moduleMap[context.routesPath] ||
    (await compileRoutesModule(context, moduleMap, (id, importer, isDynamic) =>
      (isDynamic ? ssrRequire : require)(id, importer, isDynamic)
    ))

  const routesConfig = setRoutesModule({
    catchRoute: undefined,
    defaultRoute: undefined,
    defaultState: [],
    htmlProcessors: undefined,
    routes: [],
    runtimeHooks: [],
    requestHooks: undefined,
    responseHooks: undefined,
    ssrRequire,
  })
  try {
    await executeModule(routesModule)

    // Exclude the routes module from its package, or else it
    // will have its modules cleared when it shouldn't.
    routesModule.package?.delete(routesModule)
    routesModule.package = undefined

    for (const route of routesConfig.routes) {
      if (!route.moduleId) continue
      if (route.generated) {
        let resolved = await context.resolveId(
          route.moduleId,
          context.routesPath
        )
        if (!resolved) {
          const error = Error(
            `Cannot find module "${
              route.moduleId
            }" (imported by ${relativeToCwd(context.routesPath)})`
          )
          throw Object.assign(error, {
            code: 'ERR_MODULE_NOT_FOUND',
          })
        }
        if (typeof resolved !== 'string') {
          resolved = resolved.id
        }
        route.moduleId = toDevPath(resolved, context.root)
      }
    }

    await callPlugins(context.plugins, 'receiveRoutes', routesConfig)
    Object.assign(context, routesConfig)
    injectRoutesMap(context as SausContext)

    debug(`Loaded the routes module in ${Date.now() - time}ms`)
  } catch (error: any) {
    formatAsyncStack(error, moduleMap, [], context.config.filterStack)
    throw error
  } finally {
    setRoutesModule(null)
  }
}

type CompileContext = Pick<
  SausContext,
  'root' | 'routesPath' | 'compileCache' | 'config' | 'resolveId'
>

async function compileRoutesModule(
  context: CompileContext,
  moduleMap: ModuleMap,
  requireAsync: RequireAsync
) {
  const { resolveId, routesPath, root } = context

  // Import specifiers for route modules need to be rewritten
  // as dev URLs for them to be imported properly by the browser.
  const code = fs.readFileSync(routesPath, 'utf8')
  const editor = new MagicString(code)
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
    moduleMap,
    compileNodeModule(
      editor.toString(),
      routesPath,
      requireAsync,
      context.compileCache,
      context.config.env
    )
  )
}

/**
 * This injects the `routes` object exported by `saus/client`.
 */
function injectRoutesMap(context: SausContext) {
  const routesMap: Record<string, string> = {}

  const loaders: Record<string, () => Promise<any>> = {}
  Object.defineProperty(routesMap, 'loaders', {
    value: loaders,
    configurable: true,
  })

  let route: Route | undefined
  if ((route = context.defaultRoute)) {
    routesMap.default = route.moduleId!
    loaders.default = route.load
  }
  for (let i = context.routes.length; --i >= 0; ) {
    route = context.routes[i]
    if (route.moduleId) {
      routesMap[route.path] = route.moduleId
      loaders[route.path] = route.load
    }
  }

  const routesMapPath = path.resolve(__dirname, '../client/routes.cjs')
  injectNodeModule(routesMapPath, routesMap)

  if (context.command == 'serve') {
    // Do nothing if already registered.
    if (!context.liveModulePaths.has(routesMapPath)) {
      context.liveModulePaths.add(routesMapPath)

      // Eagerly invalidate our importers when the routes module
      // is changed, thereby merging the two reload passes.
      context.watcher.on('change', file => {
        if (file === context.routesPath) {
          context.hotReload(routesMapPath)
        }
      })
    }
  }
}
