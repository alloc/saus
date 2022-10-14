import { renderRoutePath } from '@utils/renderRoutePath'
import type { RouteParams } from './routeTypes'

export function getPagePath(
  routePath: string,
  routeParams?: RouteParams | null
) {
  if (routeParams) {
    return renderRoutePath(routePath, routeParams)
  }
  return routePath
}
