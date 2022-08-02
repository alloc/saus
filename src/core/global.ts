import type { Route, RoutesModule } from './routes'

export let routesModule: RoutesModule

export const setRoutesModule = (module: RoutesModule | null) =>
  (routesModule = module!)

export const routeStack: Route[] = []

export const withParentRoute = (parent: Route, children: () => void) => {
  const { requestHooks, responseHooks } = routesModule
  routeStack.push(parent)
  routesModule.requestHooks = parent.requestHooks || []
  routesModule.responseHooks = parent.responseHooks || []
  try {
    children()
  } finally {
    routeStack.pop()
    if (routesModule.requestHooks.length) {
      parent.requestHooks = routesModule.requestHooks
    }
    if (routesModule.requestHooks.length) {
      parent.responseHooks = routesModule.responseHooks
    }
    routesModule.requestHooks = requestHooks
    routesModule.responseHooks = responseHooks
  }
}
