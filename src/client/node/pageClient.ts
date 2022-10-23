import { globalCache } from '@runtime/cache'
import { getPagePath } from '@runtime/getPagePath'
import { Route } from '@runtime/routeTypes'
import { noop } from '@utils/noop'
import { RequireAsync } from '@vm/types'
import type { PageClient } from '../pageClient'

interface Context {
  ssrRequire: RequireAsync
  routes: Route[]
  defaultRoute?: Route
  routeClients: {
    getClientByRoute: (route: Route) => { url: string }
  }
}

declare const require: any

export async function loadPageClient(routePath: string, routeParams?: any) {
  const context: Context = (void 0, require)('./context.cjs')
  const { ssrRequire, routes, defaultRoute, routeClients } = context

  const route =
    routePath == 'default'
      ? defaultRoute
      : routes.find(route => route.path == routePath)

  const routeClient = route && routeClients.getClientByRoute(route)
  if (routeClient) {
    const pagePath = getPagePath(routePath, routeParams)
    const client: PageClient = await ssrRequire(routeClient.url)
    client.props = await globalCache.load<any>(pagePath, noop, {
      acceptExpired: true,
    })
    return client
  }

  throw Error(`Unknown route: "${routePath}"`)
}
