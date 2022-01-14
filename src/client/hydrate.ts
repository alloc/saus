import type { ClientState, RenderRequest } from '../core'
import { loadedStateCache } from './cache'
import routes from './routes'

export type HydrateFn = (routeModule: any, request: RenderRequest) => void

let runHydration: HydrateFn

export function hydrate(routeModule: object, state: ClientState) {
  if (import.meta.env.DEV && !runHydration) {
    throw Error(`[saus] "onHydrate" must be called before "hydrate"`)
  }
  const routePath = import.meta.env.BASE_URL + state.routePath.slice(1)
  routes[routePath] = {
    load: async () => routeModule,
    preload() {},
  }
  const path = location.pathname
  loadedStateCache.set(path, state)
  runHydration(routeModule, {
    path,
    query: location.search.slice(1),
    params: state.routeParams,
    state,
  })
}

// TODO: support multiple hydration handlers
export function onHydrate(hydrate: HydrateFn) {
  runHydration = hydrate
}
