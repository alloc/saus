import {
  InferRouteParams,
  RegexParam,
  Route,
  RouteConfig,
  RouteLoader,
} from './core'
import { routesModule } from './core/global'

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
  const route = {
    path,
    load,
    moduleId: parseDynamicImport(load),
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
