import endent from 'endent'
import { getRouteRenderer, RouteRenderer } from './routeRenderer'
import type { Route } from './routes'
import type { RouteLayout } from './runtime/layouts'
import { unwrapDefault } from './utils/unwrapDefault'
import type { ResolvedConfig } from './vite'
import type { ViteFunctions } from './vite/functions'
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
  renderer: RouteRenderer
  promise: Promise<string | null>
}

export const clientPreloadsMarker = '__CLIENT_PRELOADS__'

type Context = {
  config: ResolvedConfig
  defaultLayout: { id: string; hydrated?: boolean }
  resolveId: ViteFunctions['resolveId']
  ssrRequire: RequireAsync
}

export function renderRouteClients(
  context: Context,
  renderers?: RouteRenderer[]
): RouteClients {
  const clientsById: Record<string, RouteClient> = {}
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
    return renderRouteClient({
      hydratorId,
      routeModuleId,
      layoutModuleId,
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
        const renderer = renderers
          ? renderers.find(r => r.routes.includes(route))!
          : getRouteRenderer(route, context)
        const clientFile = 'client/' + renderer.fileName
        const clientId = '\0' + clientFile
        const client = (clientsById[clientId] ||= {
          id: clientId,
          url: '/.saus/' + clientFile,
          renderer,
          promise: loadRouteClient(clientId, renderer),
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
