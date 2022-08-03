import type { Route, RoutesModule } from '../routes'

export let routesModule: RoutesModule

export const setRoutesModule = (module: RoutesModule | null) =>
  (routesModule = module!)

export const routeStack: Route[] = []

type RouteContextKey = keyof Route & keyof RoutesModule

const routeContextKeys: RouteContextKey[] = [
  'defaultState',
  'requestHooks',
  'responseHooks',
]

/**
 * Ensure the following function calls are applied to a given route,
 * instead of being applied globally:
 *
 * - `route`
 * - `includeState`
 * - `onRequest`
 * - `onResponse`
 */
export function useParentRoute(parent: Route) {
  const cache: any = {}
  for (const key of routeContextKeys) {
    cache[key] = routesModule[key]
    routesModule[key] = parent[key] as any
  }
  routeStack.push(parent)
  return () => {
    routeStack.pop()
    for (const key of routeContextKeys) {
      const value = routesModule[key]
      routesModule[key] = cache[key]
      if (value !== undefined) {
        parent[key] = value as any
      }
    }
  }
}
