import type { DevContext } from '../../context'
import { getCachedState } from '../../runtime/getCachedState'
import { getPagePath } from '../../utils/getPagePath'
import type { PageClient } from '../pageClient'

export async function loadPageClient(routePath: string, routeParams?: any) {
  const { ssrRequire, routes, routeClients }: DevContext = (void 0, require)(
    '../core/context.cjs'
  )
  const route = routes.find(route => route.path == routePath)
  const routeClient = route && routeClients.getClientByRoute(route)
  if (routeClient) {
    const pagePath = getPagePath(routePath, routeParams)
    const client: PageClient = await ssrRequire(routeClient.url)
    client.props = await getCachedState(pagePath, cache => cache.oldValue)
    return client
  }
  throw Error(`Unknown route: "${routePath}"`)
}
