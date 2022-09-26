import { LazyPromise } from '@/utils/LazyPromise'
import endent from 'endent'
import type { SausContext } from './context'
import type { RouteRenderer } from './routeRenderer'
import type { Route } from './routes'
import type { RouteLayout } from './runtime/layouts'
import { unwrapDefault } from './utils/unwrapDefault'

export interface RouteClients {
  /** Route clients by virtual ID */
  clientsById: Readonly<Record<string, RouteClient | undefined>>
  clientsByUrl: Readonly<Record<string, RouteClient | undefined>>
  routesByClientId: Readonly<Record<string, Route[]>>
  getClientByRoute(route: Route): RouteClient | undefined
  /**
   * Add a route only if you'll need its client soon. \
   * The client URL is returned.
   */
  addRoute(route: Route): RouteClient | undefined
}

export interface RouteClient {
  id: string
  url: string
  renderer: RouteRenderer
  promise: LazyPromise<string | null>
  chunk?: { fileName: string }
}

export const clientPreloadsMarker = '__CLIENT_PRELOADS__'

export function renderRouteClients(
  context: SausContext,
  transform?: (code: string) => string
): RouteClients {
  const clientsById: Record<string, RouteClient> = {}
  const clientsByUrl: Record<string, RouteClient> = {}
  const clientsByRoute = new Map<Route, RouteClient>()
  const routesByClientId: Record<string, Route[]> = {}

  const loadRouteClient = async (
    clientId: string,
    { layoutModuleId, routeModuleId }: RouteRenderer
  ): Promise<string | null> => {
    const layoutModule = await context.ssrRequire(layoutModuleId)
    const layout = unwrapDefault<RouteLayout>(layoutModule)
    if (!layout.hydrator) {
      return null
    }
    const hydratorId = (await context.resolveId(layout.hydrator, clientId))?.id
    if (!hydratorId) {
      throw Error(`Hydrator module not found: "${layout.hydrator}"`)
    }
    const { config, defaultLayout } = context
    if (layoutModuleId == defaultLayout.id) {
      defaultLayout.hydrated = true
    }
    let code = renderRouteClient({
      hydratorId,
      routeModuleId,
      layoutModuleId,
      preExport: config.command == 'build' ? clientPreloadsMarker + '\n' : '',
    })
    if (transform) {
      code = transform(code)
    }
    return code
  }

  const addRoute = (route: Route) => {
    const { renderer } = route
    if (renderer) {
      const clientFile = 'client/' + renderer.fileName
      const clientId = '\0' + clientFile

      let client = clientsById[clientId]
      if (!client) {
        const clientUrl = '/.saus/' + clientFile
        client = {
          id: clientId,
          url: clientUrl,
          renderer,
          promise: new LazyPromise(resolve => {
            resolve(loadRouteClient(clientId, renderer))
          }),
        }
        clientsById[clientId] = client
        clientsByUrl[clientUrl] = client
      }

      const routes = (routesByClientId[clientId] ||= [])
      clientsByRoute.set(route, client)
      routes.push(route)
      return client
    }
  }

  context.routes.forEach(addRoute)
  context.defaultRoute && addRoute(context.defaultRoute)
  context.catchRoute && addRoute(context.catchRoute)

  return {
    clientsById,
    clientsByUrl,
    routesByClientId,
    getClientByRoute: clientsByRoute.get.bind(clientsByRoute),
    addRoute,
  }
}

/**
 * Generate the client module that determines how
 * a given route is hydrated.
 */
export const renderRouteClient = (opts: {
  /** Module with layout-compatible exports */
  routeModuleId: string
  /** Module with `layout` object as `default` export */
  layoutModuleId: string
  /** Module with `hydrate` function as `default` export */
  hydratorId: string
  /** Code inserted before `export default` statement */
  preExport?: string
}) => endent`
  ${opts.preExport || ''}
  export { default as hydrate } from "${opts.hydratorId}"
  export { default as layout } from "${opts.layoutModuleId}"
  export * as routeModule from "${opts.routeModuleId}"
`
