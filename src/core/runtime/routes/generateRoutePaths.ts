import { RoutesModule, RouteParams } from '../routeTypes'

type RoutePathHandlers = {
  path: (path: string, params?: RouteParams) => void
  error: (error: { reason: string; path: string }) => void
}


/**
 * Using `context.routes` and `context.defaultRoute`, every known path
 * is passed to the `path` handler. The default route generates the
 * `default` path. Routes with dynamic params will be called once per
 * element in their `paths` array, and you still need to call
 * `getPagePath` to get the real path.
 */
export async function generateRoutePaths(
  context: Pick<RoutesModule, 'routes' | 'defaultRoute' | 'defaultPath'>,
  handlers: RoutePathHandlers
) {
  const { path: onPath, error: onError } = handlers

  for (const route of context.routes) {
    if (!route.moduleId) continue
    if (route.paths) {
      if (!route.keys.length) {
        onError({
          path: route.path,
          reason: `Route with "paths" needs a route parameter`,
        })
      } else {
        for (const result of await route.paths()) {
          const values = Array.isArray(result)
            ? (result as (string | number)[])
            : [result]

          const params: RouteParams = {}
          route.keys.forEach((key, i) => {
            params[key] = '' + values[i]
          })

          onPath(route.path, params)
        }
      }
    } else if (!route.keys.length) {
      onPath(route.path)
    }
  }

  if (context.defaultRoute) {
    onPath(context.defaultPath)
  }
}
