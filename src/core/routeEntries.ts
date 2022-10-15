import { dataToEsm } from '@runtime/dataToEsm'
import type { RouteRenderer } from '@runtime/routeTypes'
import endent from 'endent'

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
