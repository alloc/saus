import { RegexParam, RouteParams } from '../core/routes'

export function getPagePath(
  routePath: string,
  routeParams?: RouteParams | null
) {
  if (routeParams) {
    return RegexParam.inject(routePath, routeParams)
  }
  return routePath
}
