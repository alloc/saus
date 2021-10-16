import type { RenderRequest } from '../core'
import { state } from './state'
import routes from './routes'

export type HydrateFn = (routeModule: any, request: RenderRequest) => void

let runHydration: HydrateFn

export function hydrate(routeModule: object, path: string) {
  if (import.meta.env.DEV && !runHydration) {
    throw Error(`[saus] "onHydrate" must be called before "hydrate"`)
  }
  routes[state.routePath] = async () => routeModule
  runHydration(routeModule, { path, params: state.routeParams, state })
}

// TODO: support multiple hydration handlers
export function onHydrate(hydrate: HydrateFn) {
  runHydration = hydrate
}
