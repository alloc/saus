import { getCachedState } from '../runtime/getCachedState'
import { baseToRegex } from '../utils/base'
import { getPagePath } from '../utils/getPagePath'
import routes from './routes'
import config from './runtimeConfig'
import { ssrImport } from './ssrModules'

const debugBaseRE = config.debugBase ? baseToRegex(config.debugBase) : null

/** This overrides `loadPageModule` (exported by `saus/client`) in SSR environment. */
export async function loadPageModule(
  routePath: string,
  routeParams: any,
  unwrapModule?: (routeModule: any, pageState: any) => any
) {
  const routeModuleUrl =
    routes[routePath] ||
    (debugBaseRE && routes[routePath.replace(debugBaseRE, '/')])
  if (!routeModuleUrl) {
    throw Error(`Unknown route: "${routePath}"`)
  }
  const routeModule = await ssrImport(routeModuleUrl)
  if (unwrapModule) {
    const pagePath = getPagePath(routePath, routeParams)
    const pageState = await getCachedState(pagePath, cache => cache.oldValue)
    return unwrapModule(routeModule, pageState)
  }
  return routeModule
}
