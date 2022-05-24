import type { RouteParams } from '../core/routes'
import { renderRoutePath } from './renderRoutePath'

export function getPagePath(
  routePath: string,
  routeParams?: RouteParams | null
) {
  if (routeParams) {
    return renderRoutePath(routePath, routeParams)
  }
  return routePath
}
