import * as RegexParam from 'regexparam'
import { routesModule } from './core/global'
import type {
  InferRouteParams,
  Route,
  RouteConfig,
  RouteLoader,
} from './core/routes'
import { parseDynamicImport } from './utils/parseDynamicImport'

export * from './core/generateRoute'

/** Define the default route */
export function route(load: RouteLoader): void

/** Define a catch route */
export function route<Module extends object>(
  path: 'error',
  load: RouteLoader<Module>,
  config?: RouteConfig<Module, { error: any }>
): void

/** Define a route */
export function route<RoutePath extends string, Module extends object>(
  path: RoutePath,
  load: RouteLoader<Module>,
  config?: RouteConfig<Module, InferRouteParams<RoutePath>>
): void

/** @internal */
export function route(
  pathOrLoad: string | RouteLoader,
  maybeLoad?: RouteLoader<any>,
  config?: RouteConfig<any, any>
) {
  const path = typeof pathOrLoad == 'string' ? pathOrLoad : 'default'
  const load = maybeLoad || (pathOrLoad as RouteLoader)
  const moduleId = parseDynamicImport(load, path)

  const route = {
    path,
    load,
    moduleId,
    ...config,
  } as Route

  if (path[0] === '/') {
    Object.assign(route, RegexParam.parse(path))
    routesModule.routes.push(route)
  } else if (path === 'default') {
    routesModule.defaultRoute = route
  } else if (path === 'error') {
    routesModule.catchRoute = route
  }
}
