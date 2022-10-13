import assert from 'assert'
import { SausContext } from './context'
import { Route } from './runtime/routeTypes'
import { murmurHash } from './utils/murmur3'

export interface RouteRenderer {
  fileName: string
  routeModuleId: string
  layoutModuleId: string
  routes: Route[]
}

type UsedKeys =
  | 'routes'
  | 'catchRoute'
  | 'defaultRoute'
  | 'defaultLayout'
  | 'resolveId'

export async function getRouteRenderers(context: Pick<SausContext, UsedKeys>) {
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

function getRouteRenderer(
  route: Route,
  context: Pick<SausContext, 'defaultLayout'>
): RouteRenderer {
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
