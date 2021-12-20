import { matchRoute, RenderModule, RoutesModule } from '../core'
import { setRenderModule, setRoutesModule } from '../core/global'

/**
 * SSR bundles import this function and wrap their "render module"
 * and "routes module" with it.
 */
export function main(install: () => Promise<void>) {
  let context: RenderModule & RoutesModule

  return async function (pageUrl: string) {
    if (!context) {
      context = {
        beforeRenderHooks: [],
        renderers: [],
        routes: [],
      }

      setRenderModule(context)
      setRoutesModule(context)

      await install()
    }
    for (const route of context.routes) {
      const params = matchRoute(pageUrl, route)
      if (params) {
      }
    }
  }
}
