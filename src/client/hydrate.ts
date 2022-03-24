import type { ClientState, RenderRequest } from '../core'
import { globalCache } from '../runtime/cache'
import { getPageFilename } from '../utils/getPageFilename'
import { BASE_URL } from './baseUrl'
import routes from './routes'

export type HydrateFn = (request: RenderRequest) => Promise<void> | void

let runHydration: HydrateFn

export async function hydrate(
  state: ClientState,
  routeModule: object,
  routeModuleUrl: string
) {
  if (import.meta.env.DEV && !runHydration) {
    throw Error(`[saus] "onHydrate" must be called before "hydrate"`)
  }
  const routePath = state.routePath.replace('/', BASE_URL)
  routes[routePath] = routeModuleUrl
  const path = location.pathname
  globalCache.loaded[path] = [state]
  await runHydration({
    path,
    file: getPageFilename(path, import.meta.env.BASE_URL),
    query: location.search.slice(1),
    params: state.routeParams,
    module: routeModule,
    state,
  })
  saus.hydrated = true
}

// TODO: support multiple hydration handlers
export function onHydrate(hydrate: HydrateFn) {
  runHydration = hydrate
}
