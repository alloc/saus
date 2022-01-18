import type { RouteParams } from '../core'
import { getPagePath } from '../utils/getPagePath'
import { loadClientState } from './state'
import routes from './routes'

export function loadPageModule(routePath: string, routeParams?: RouteParams) {
  const routeModuleUrl = routes[routePath]
  if (!routeModuleUrl) {
    throw Error(`Unknown route: "${routePath}"`)
  }
  return loadClientState(getPagePath(routePath, routeParams)).then(
    () => import(/* @vite-ignore */ routeModuleUrl)
  )
}
