import endent from 'endent'
import type { RouteRenderer } from './routeRenderer'
import type { RouteModule } from './routes'
import type { RouteLayout } from './runtime/layouts'
import { dataToEsm } from './utils/dataToEsm'
import { AnyToObject } from './utils/types'

/**
 * Server-side route entry
 */
export interface RouteEntry<
  Props extends object = any,
  Module extends object = any,
  RenderResult = any
> {
  layout: RouteLayout<Props, any, Module, RenderResult>
  routeModule: AnyToObject<Module, RouteModule>
  /** This exists in server context only. */
  routes?: string[]
}

export function renderRouteEntry({
  routes,
  routeModuleId,
  layoutModuleId,
}: RouteRenderer) {
  return endent`
    export { default as layout } from "${layoutModuleId}"
    export * as routeModule from "${routeModuleId}"
    export ${dataToEsm(
      Array.from(routes, route => route.path),
      'routes'
    )}
  `
}
