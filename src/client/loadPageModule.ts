import type { RouteParams } from '../core'
import { getPagePath } from '../utils/getPagePath'
import { applyHead } from './head'
import routes from './routes'
import { loadClientState } from './state'

export function loadPageModule(routePath: string, routeParams?: RouteParams) {
  const routeModuleUrl = routes[routePath]
  if (!routeModuleUrl) {
    throw Error(`Unknown route: "${routePath}"`)
  }
  const pagePath = getPagePath(routePath, routeParams)
  return loadClientState(pagePath).then(() => {
    // Add any desired <link> tags and update the <title> tag
    // before executing the route module.
    applyHead(pagePath)

    return import(/* @vite-ignore */ routeModuleUrl)
  })
}
