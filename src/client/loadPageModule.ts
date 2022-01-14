import type { RouteParams } from '../core'
import { getPagePath } from '../utils/getPagePath'
import { loadClientState } from './state'
import routes from './routes'

export async function loadPageModule(
  routePath: string,
  routeParams?: RouteParams
) {
  const route = routes[routePath]
  route.preload()
  await loadClientState(getPagePath(routePath, routeParams))
  return route.load()
}
