import * as esModuleLexer from 'es-module-lexer'
import fs from 'fs'
import MagicString from 'magic-string'
import path from 'path'
import { relativeToCwd } from '../utils/relativeToCwd'
import { toDevPath } from '../utils/toDevPath'
import { injectExports } from '../vm/asyncRequire'
import { compileNodeModule } from '../vm/compileNodeModule'
import { executeModule } from '../vm/executeModule'
import { formatAsyncStack } from '../vm/formatAsyncStack'
import { registerModuleOnceCompiled } from '../vm/moduleMap'
import { ModuleMap, RequireAsync, ResolveIdHook } from '../vm/types'
import { SausContext } from './context'
import { debug } from './debug'
import { getRequireFunctions } from './getRequireFunctions'
import { setRoutesModule } from './global'
import { Route } from './routes'

export async function loadRoutes(
  context: SausContext,
  resolveId: ResolveIdHook
) {
  const time = Date.now()
  const moduleMap = context.server?.moduleMap || {}
  const { require, ssrRequire } =
    context.server || getRequireFunctions(context, resolveId, moduleMap)

  const routesModule =
    moduleMap[context.routesPath] ||
    (await compileRoutesModule(
      context,
      moduleMap,
      resolveId,
      (id, importer, isDynamic) =>
        (isDynamic ? ssrRequire : require)(id, importer, isDynamic)
    ))

  const routesConfig = setRoutesModule({
    catchRoute: undefined,
    defaultRoute: undefined,
    defaultState: [],
    htmlProcessors: undefined,
    routes: [],
    runtimeHooks: [],
    requestHooks: [],
    responseHooks: [],
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
        const resolved = await resolveId(
          route.moduleId,
          context.routesPath,
          true
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
        route.moduleId = toDevPath(resolved.id, context.root)
      }
    }

    Object.assign(context, routesConfig)
    injectRoutesMap(context)

    debug(`Loaded the routes module in ${Date.now() - time}ms`)
  } catch (error: any) {
    formatAsyncStack(error, moduleMap, [], context.config.filterStack)
    throw error
  } finally {
    setRoutesModule(null)
  }
}

async function compileRoutesModule(
  context: SausContext,
  moduleMap: ModuleMap,
  resolveId: ResolveIdHook,
  requireAsync: RequireAsync
) {
  const { routesPath, root } = context

  // Import specifiers for route modules need to be rewritten
  // as dev URLs for them to be imported properly by the browser.
  const code = fs.readFileSync(routesPath, 'utf8')
  const editor = new MagicString(code)
  for (const imp of esModuleLexer.parse(code)[0]) {
    if (imp.d >= 0 && imp.n) {
      const resolved = await resolveId(imp.n, routesPath, true)
      if (resolved) {
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
  injectExports(routesMapPath, routesMap)
}
