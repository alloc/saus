import { ssrRequire } from '../ssrModules'
import routes from './routes'

/** This overrides `loadPageModule` (exported by `saus/client`) in SSR environment. */
export const loadPageModule = (routePath: string) =>
  ssrRequire(routes[routePath])
