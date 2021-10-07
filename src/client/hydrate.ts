import type { PageRequest } from '../render'
import routes from './routes'

export { PageRequest }

export type HydrateFn = (routeModule: any, request: PageRequest) => void

let runHydration: HydrateFn

export function hydrate(routeModule: object, request: PageRequest) {
  routes[request.state.routePath] = async () => routeModule
  runHydration(routeModule, request)
}

// TODO: support multiple hydration handlers
export function onHydrate(hydrate: HydrateFn) {
  runHydration = hydrate
}
