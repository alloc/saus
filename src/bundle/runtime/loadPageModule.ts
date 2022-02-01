import { ssrRequire } from './ssrModules'
import routes from './routes'

/** This overrides `loadPageModule` (exported by `saus/client`) in SSR environment. */
export const loadPageModule = (routePath: string) => {
  const routeModuleUrl = routes[routePath]
  if (!routeModuleUrl) {
    throw Error(`Unknown route: "${routePath}"`)
  }
  return ssrRequire(routeModuleUrl)
}
