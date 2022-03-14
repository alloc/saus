import { getCachedState } from '../../runtime/getCachedState'
import { getPagePath } from '../../utils/getPagePath'

export async function loadPageModule(
  routePath: string,
  routeParams?: any,
  unwrapModule?: (routeModule: any, pageState: any) => any
) {
  const load = (void 0, require)('../client/routes.cjs').loaders[routePath]
  if (load) {
    const pagePath = getPagePath(routePath, routeParams)
    const routeModule = await load()
    if (unwrapModule) {
      const pageState = await getCachedState(pagePath, cache => cache.oldValue)
      return unwrapModule(routeModule, pageState)
    }
    return routeModule
  }
  throw Error(`Unknown route: "${routePath}"`)
}
