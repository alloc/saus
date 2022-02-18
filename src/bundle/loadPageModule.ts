import { getCachedState } from '../runtime/getCachedState'
import { getPagePath } from '../utils/getPagePath'
import { ssrImport } from './ssrModules'
import routes from './routes'

/** This overrides `loadPageModule` (exported by `saus/client`) in SSR environment. */
export async function loadPageModule(
  routePath: string,
  routeParams: any,
  unwrapModule?: (routeModule: any, pageState: any) => any
) {
  const routeModuleUrl = routes[routePath]
  if (!routeModuleUrl) {
    throw Error(`Unknown route: "${routePath}"`)
  }
  const routeModule = await ssrImport(routeModuleUrl)
  if (unwrapModule) {
    const pagePath = getPagePath(routePath, routeParams)
    const pageState = await getCachedState(pagePath)
    return unwrapModule(routeModule, pageState)
  }
  return routeModule
}
