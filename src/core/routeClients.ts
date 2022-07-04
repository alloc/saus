import endent from 'endent'
import type { Route } from './routes'
import type { RouteLayout } from './runtime/layouts'
import { md5Hex } from './utils/md5-hex'
import { unwrapDefault } from './utils/unwrapDefault'
import { ResolvedConfig } from './vite'
import type { RequireAsync } from './vm'

export interface RouteClients {
  /** Route clients by virtual ID */
  clientsById: Record<string, RouteClient | undefined>
  routesByClientId: Record<string, Route[]>
  getClientByRoute(route: Route): Promise<RouteClient | undefined>
  /**
   * Add a route only if you'll need its client soon. \
   * The client URL is returned.
   */
  addRoute(route: Route): RouteClient | undefined
}

export interface RouteClient {
  id: string
  url: string
  layoutEntry: string
  promise: Promise<string | null>
}

export const clientPreloadsMarker = '__CLIENT_PRELOADS__'

type Context = {
  config: ResolvedConfig
  defaultLayout: { id: string; hydrated?: boolean }
  ssrRequire: RequireAsync
}

export function renderRouteClients(context: Context): RouteClients {
  const clientsById: Record<string, RouteClient> = {}
  const clientsByRoute = new Map<Route, RouteClient>()
  const routesByClientId: Record<string, Route[]> = {}

  const loadRouteClient = async (
    routeModuleId: string,
    layoutModuleId: string
  ): Promise<string | null> => {
    const layoutModule = await context.ssrRequire(layoutModuleId)
    const layout = unwrapDefault<RouteLayout>(layoutModule)
    if (!layout.hydrator) {
      return null
    }
    const { config, defaultLayout } = context
    if (layoutModuleId == defaultLayout.id) {
      defaultLayout.hydrated = true
    }
    return renderRouteClient({
      routeModuleId,
      layoutModuleId,
      hydratorId: layout.hydrator,
      preExport: config.command == 'build' ? clientPreloadsMarker + '\n' : '',
    })
  }

  return {
    clientsById,
    routesByClientId,
    async getClientByRoute(route) {
      return clientsByRoute.get(route)
    },
    addRoute(route) {
      if (route.moduleId) {
        const layoutEntry = route.layoutEntry || context.defaultLayout.id
        const clientHash = md5Hex([layoutEntry, route.moduleId]).slice(0, 8)
        const clientFile = 'route.client.' + clientHash + '.js'
        const clientId = '\0' + clientFile
        const client = (clientsById[clientId] ||= {
          id: clientId,
          url: '/.saus/' + clientFile,
          layoutEntry: layoutEntry,
          promise: loadRouteClient(route.moduleId, layoutEntry),
        })
        const routes = (routesByClientId[clientId] ||= [])
        clientsByRoute.set(route, client)
        routes.push(route)
        return client
      }
    },
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
  import layout from "${opts.layoutModuleId}"
  import hydrate from "${opts.hydratorId}"
  import * as routeModule from "${opts.routeModuleId}"
  ${opts.preExport || ''}
  export default {
    layout,
    hydrate,
    route: {
      url: "${opts.routeModuleId}",
      module: routeModule,
    }
  }
`
