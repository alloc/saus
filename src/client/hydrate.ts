import type { ClientState, RenderRequest } from '../core'
import { loadedStateCache } from '../core/cache'
import routes from './routes'

export type HydrateFn = (request: RenderRequest) => void

let runHydration: HydrateFn

export function hydrate(
  state: ClientState,
  routeModule: object,
  routeModuleUrl: string
) {
  if (import.meta.env.DEV && !runHydration) {
    throw Error(`[saus] "onHydrate" must be called before "hydrate"`)
  }
  const routePath = state.routePath.replace('/', import.meta.env.BASE_URL)
  routes[routePath] = routeModuleUrl
  const path = location.pathname
  loadedStateCache.set(path, state)
  runHydration({
    path,
    query: location.search.slice(1),
    params: state.routeParams,
    module: routeModule,
    state,
  })
}

// TODO: support multiple hydration handlers
export function onHydrate(hydrate: HydrateFn) {
  runHydration = hydrate
}
