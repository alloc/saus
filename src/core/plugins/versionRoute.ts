import endent from 'endent'
import { Plugin } from '../vite'

/**
 * When the `appVersion` bundle option is defined, this plugin will
 * add a route to the bundle that responds with it.
 */
export function versionRoute(
  appVersion: string,
  routePath = '/.saus/app/version'
): Plugin {
  return {
    name: 'saus:version-route',
    saus: {
      injectModules({ ssr, appendModule }) {
        if (!ssr) return
        appendModule({
          id: '\0@saus/version-route.js',
          code: endent`
            import { route } from 'saus'
            route("${routePath}").get(req => {
              req.respondWith(200, { text: "${appVersion}" })
            })
          `,
        })
      },
    },
  }
}
