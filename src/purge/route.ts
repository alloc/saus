import { Endpoint } from '@/endpoint'
import { route } from '@/runtime/routes'
import { makePurgeRequest } from './request'
import { PurgeOptions, PurgePlugin } from './types'

export interface PurgeRouteConfig {
  plugins: PurgePlugin[]
  validate?: (req: Endpoint.Request) => boolean
}

/**
 * To execute the given plugins, send a POST request with a `PurgeRequest`
 * JSON object to the specified route path.
 *
 * The route is unauthenticated, so its path should be hard to guess.
 *
 * Plugins are executed sequentially.
 */
export function addPurgeRoute(routePath: string, config: PurgeRouteConfig) {
  route(routePath).post(async req => {
    if (config.validate && !config.validate(req)) {
      return req.respondWith(403)
    }
    const options = await req.json<PurgeOptions>()
    const request = makePurgeRequest('route', options)
    for (const plugin of config.plugins) {
      if (plugin.expandGlobs) {
        const expanded = await plugin.expandGlobs(request.globs)
        const files = new Set([...expanded, ...request.files])
        await plugin.purge({ ...request, files })
      } else {
        await plugin.purge(request)
      }
    }
  })
}
