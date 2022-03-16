import type { ClientState, RouteModule, RouteParams } from '../core'
import { getPagePath } from '../utils/getPagePath'
import { applyHead } from './head'
import { loadPageState } from './loadPageState'
import routes from './routes'

export async function loadPageModule<PageModule = RouteModule>(
  routePath: string,
  routeParams?: RouteParams,
  unwrapModule?: (
    routeModule: RouteModule,
    pageState: ClientState
  ) => PageModule | Promise<PageModule>
): Promise<PageModule> {
  const routeModuleUrl = routes[routePath]
  if (!routeModuleUrl) {
    throw Error(`Unknown route: "${routePath}"`)
  }

  const pagePath =
    routePath !== 'default'
      ? getPagePath(routePath, routeParams)
      : saus.defaultPath

  try {
    const pageState = await loadPageState(pagePath)

    // Add any desired <link> tags and update the <title> tag
    // before executing the route module.
    applyHead(pagePath)

    const routeModule = await import(/* @vite-ignore */ routeModuleUrl)
    return unwrapModule ? unwrapModule(routeModule, pageState) : routeModule
  } catch (error: any) {
    if (error.code == 'PAGE_404' && routePath !== 'default') {
      return loadPageModule('default', undefined, unwrapModule)
    }
    throw error
  }
}
