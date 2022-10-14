import { Route, RouteRenderer, RoutesModule } from '@runtime/routeTypes'
import { murmurHash } from '@utils/murmur3'
import { ResolveIdHook } from '@utils/rollupTypes'
import assert from 'assert'

interface Context extends RoutesModule {
  defaultLayout: { id: string; hydrated?: boolean }
  resolveId: ResolveIdHook
}

export async function getRouteRenderers(context: Context) {
  const resolving: Promise<any>[] = []
  const resolve = (
    renderer: RouteRenderer,
    key: 'layoutModuleId' | 'routeModuleId'
  ) =>
    context.resolveId(renderer[key]).then(resolved => {
      if (!resolved) {
        throw Error(`Failed to resolve "${renderer[key]}"`)
      }
      renderer[key] = resolved.id
    })

  const renderers: Record<string, RouteRenderer> = {}
  const addRoute = (route: Route) => {
    if (!route.moduleId) {
      return
    }
    const renderer = getRouteRenderer(route, context)
    const existing = renderers[renderer.fileName]
    if (existing) {
      route.renderer = existing
      existing.routes.push(route)
    } else {
      route.renderer = renderer
      renderers[renderer.fileName] = renderer
      resolving.push(
        resolve(renderer, 'layoutModuleId'),
        resolve(renderer, 'routeModuleId')
      )
    }
  }

  context.routes.forEach(addRoute)
  context.defaultRoute && addRoute(context.defaultRoute)
  context.catchRoute && addRoute(context.catchRoute)

  await Promise.all(resolving)
  return Object.values(renderers)
}

function getRouteRenderer(route: Route, context: Context): RouteRenderer {
  assert(route.moduleId)
  const layoutModuleId = route.layoutEntry || context.defaultLayout.id
  const hash = murmurHash(layoutModuleId + route.moduleId)
  return {
    fileName: 'renderer.' + hash + '.js',
    routeModuleId: route.moduleId,
    layoutModuleId,
    routes: [route],
  }
}
