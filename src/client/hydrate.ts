import type { RenderRequest } from '../core'
import routes from './routes'

export { RenderRequest }

export type HydrateFn = (routeModule: any, request: RenderRequest) => void

let runHydration: HydrateFn

export function hydrate(routeModule: object, request: RenderRequest) {
  routes[request.state.routePath] = async () => routeModule
  runHydration(routeModule, request)
}

// TODO: support multiple hydration handlers
export function onHydrate(hydrate: HydrateFn) {
  runHydration = hydrate
}
