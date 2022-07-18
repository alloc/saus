import endent from 'endent'
import { BundleContext } from '../context'

/**
 * When the `appVersion` bundle option is defined, this plugin will
 * add a route to the bundle that responds with it.
 */
export function injectAppVersionRoute(
  appVersion: string,
  context: BundleContext
) {
  const routePath = '/.saus/app/version'
  context.injectedImports.prepend.push(
    context.injectedModules.addServerModule({
      id: '\0@saus/routes/appVersion.js',
      code: endent`
        import { route } from 'saus'

        route("${routePath}").get(req => {
          req.respondWith(200, { text: "${appVersion}" })
        })
      `,
    }).id
  )
}
