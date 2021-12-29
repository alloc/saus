import * as RegexParam from 'regexparam'
import { routesModule } from './core/global'
import type {
  InferRouteParams,
  Route,
  RouteConfig,
  RouteLoader,
} from './core/routes'

const importRE = /\b__vite_ssr_dynamic_import__\(["']([^"']+)["']\)/
const parseDynamicImport = (fn: Function) => importRE.exec(fn.toString())![1]

/** Define a route */
export function route<RoutePath extends string, Module extends object>(
  path: RoutePath,
  load: RouteLoader<Module>,
  config?: RouteConfig<Module, InferRouteParams<RoutePath>>
): void

/** Define the default route */
export function route(load: RouteLoader): void

/** @internal */
export function route(
  pathOrLoad: string | RouteLoader,
  maybeLoad?: RouteLoader<any>,
  config?: RouteConfig<any, any>
) {
  const path = typeof pathOrLoad == 'string' ? pathOrLoad : 'default'
  const load = maybeLoad || (pathOrLoad as RouteLoader)

  let moduleId: string
  try {
    moduleId = parseDynamicImport(load)
  } catch (e: any) {
    console.log('load: %O', load.toString())
    throw Error(`Failed to parse "moduleId" for route: "${path}"\n` + e.message)
  }

  const route = {
    path,
    load,
    moduleId,
    ...config,
  } as Route

  if (path === 'default') {
    route.keys = []
    route.pattern = /./
    routesModule.defaultRoute = route
  } else {
    Object.assign(route, RegexParam.parse(path))
    routesModule.routes.push(route)
  }
}
