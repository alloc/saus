import { ssrImport } from './ssrModules'
import routes from './routes'

/** This overrides `loadPageModule` (exported by `saus/client`) in SSR environment. */
export function loadPageModule(
  routePath: string,
  _routeParams?: any,
  unwrapModule?: (routeModule: any) => any
) {
  const routeModuleUrl = routes[routePath]
  if (!routeModuleUrl) {
    throw Error(`Unknown route: "${routePath}"`)
  }
  const routeModule = ssrImport(routeModuleUrl)
  if (unwrapModule) {
    return routeModule.then(unwrapModule)
  }
  return routeModule
}
