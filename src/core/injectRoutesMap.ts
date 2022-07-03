import path from 'path'
import { SausContext } from './context'
import { Route } from './routes'
import { injectNodeModule } from './vm/nodeModules'

/**
 * This injects the `routes` object exported by `saus/client`.
 */
export function injectRoutesMap(context: SausContext) {
  const routesMap: Record<string, string> = {}

  const loaders: Record<string, () => Promise<any>> = {}
  Object.defineProperty(routesMap, 'loaders', {
    value: loaders,
    configurable: true,
  })

  let route: Route | undefined
  if ((route = context.defaultRoute)) {
    routesMap.default = route.moduleId!
    loaders.default = route.load
  }
  for (let i = context.routes.length; --i >= 0; ) {
    route = context.routes[i]
    if (route.moduleId) {
      routesMap[route.path] = route.moduleId
      loaders[route.path] = route.load
    }
  }

  const routesMapPath = path.resolve(__dirname, '../client/routes.cjs')
  injectNodeModule(routesMapPath, routesMap)

  if (context.command == 'serve') {
    // Do nothing if already registered.
    if (!context.liveModulePaths.has(routesMapPath)) {
      context.liveModulePaths.add(routesMapPath)

      // Eagerly invalidate our importers when the routes module
      // is changed, thereby merging the two reload passes.
      context.watcher.on('change', file => {
        if (file === context.routesPath) {
          context.hotReload(routesMapPath)
        }
      })
    }
  }
}
