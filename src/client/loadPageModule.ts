import type { RouteParams } from '../core/routes'
import { getPagePath } from '../utils/getPagePath'
import { applyHead } from './head'
import { loadModule } from './loadModule'
import { loadPageState } from './loadPageState'
import routes from './routes'

export function loadPageModule(routePath: string, routeParams?: RouteParams) {
  const routeModuleUrl = routes[routePath]
  if (!routeModuleUrl) {
    throw Error(`Unknown route: "${routePath}"`)
  }
  const pagePath = getPagePath(routePath, routeParams)
  return loadPageState(pagePath).then(() => {
    // Add any desired <link> tags and update the <title> tag
    // before executing the route module.
    applyHead(pagePath)

    return loadModule(routeModuleUrl)
  })
}
