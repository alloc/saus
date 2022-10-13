import { globalCache } from '@runtime/cache'
import type { DevContext } from '../../context'
import { getPagePath } from '../../runtime/getPagePath'
import type { PageClient } from '../pageClient'

export async function loadPageClient(routePath: string, routeParams?: any) {
  const { ssrRequire, routes, defaultRoute, routeClients }: DevContext =
    (void 0, require)('../core/context.cjs')

  const route =
    routePath == 'default'
      ? defaultRoute
      : routes.find(route => route.path == routePath)

  const routeClient = route && routeClients.getClientByRoute(route)
  if (routeClient) {
    const pagePath = getPagePath(routePath, routeParams)
    const client: PageClient = await ssrRequire(routeClient.url)
    client.props = await globalCache.load(pagePath, cache => cache.oldValue!)
    return client
  }

  throw Error(`Unknown route: "${routePath}"`)
}
