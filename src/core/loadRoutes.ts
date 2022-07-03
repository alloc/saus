import * as esModuleLexer from 'es-module-lexer'
import fs from 'fs'
import MagicString from 'magic-string'
import { SausContext } from './context'
import { debug } from './debug'
import { getRequireFunctions } from './getRequireFunctions'
import { setRoutesModule } from './global'
import { callPlugins } from './utils/callPlugins'
import { compileNodeModule } from './vite/compileNodeModule'
import { executeModule } from './vm/executeModule'
import { formatAsyncStack } from './vm/formatAsyncStack'
import { registerModuleOnceCompiled } from './vm/moduleMap'
import { ModuleMap, RequireAsync } from './vm/types'

export async function loadRoutes(context: SausContext) {
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
    layoutEntries: new Set(),
    ssrRequire,
  })
  try {
    await executeModule(routesModule)

    // Exclude the routes module from its package, or else it
    // will have its modules cleared when it shouldn't.
    routesModule.package?.delete(routesModule)
    routesModule.package = undefined

    // for (const route of routesConfig.routes) {
    //   if (!route.moduleId) continue
    //   if (route.generated) {
    //     let resolved = await context.resolveId(
    //       route.moduleId,
    //       context.routesPath
    //     )
    //     if (!resolved) {
    //       const error = Error(
    //         `Cannot find module "${
    //           route.moduleId
    //         }" (imported by ${relativeToCwd(context.routesPath)})`
    //       )
    //       throw Object.assign(error, {
    //         code: 'ERR_MODULE_NOT_FOUND',
    //       })
    //     }
    //     route.moduleId = toDevPath(resolved.id, context.root)
    //   }
    // }

    await callPlugins(context.plugins, 'receiveRoutes', routesConfig)
    Object.assign(context, routesConfig)

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
