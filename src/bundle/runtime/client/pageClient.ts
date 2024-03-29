import { globalCache } from '@/cache'
import { getPagePath } from '@runtime/getPagePath'
import { ssrImport } from '@runtime/ssrModules'
import { baseToRegex } from '@utils/base'
import { noop } from '@utils/noop'
import config from '../bundle/config'
import routes from '../bundle/routes'

const debugBaseRE = config.debugBase ? baseToRegex(config.debugBase) : null

/**
 * This overrides `loadPageClient` from `saus/client` in server context.
 *
 * By allowing this to be called in a server context, routers are able
 * to be client/server agnostic.
 */
export async function loadPageClient(routePath: string, routeParams: any) {
  const clientUrl =
    routes[routePath] ||
    (debugBaseRE && routes[routePath.replace(debugBaseRE, '/')])

  if (!clientUrl) {
    throw Error(`Unknown route: "${routePath}"`)
  }

  const pagePath = getPagePath(routePath, routeParams)
  const pageProps = globalCache.load<any>(pagePath, noop, {
    acceptExpired: true,
  })

  const client = await ssrImport(clientUrl)
  client.props = await pageProps
  return client
}
