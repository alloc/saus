import type { CommonClientProps, RenderRequest } from '../core'
import { globalCache } from '../runtime/cache'
import { getPageFilename } from '../utils/getPageFilename'
import routes from './routes'

export type HydrateFn = (request: RenderRequest) => Promise<void> | void

let runHydration: HydrateFn

export async function hydrate(
  props: CommonClientProps,
  routeModule: object,
  routeModuleUrl: string
) {
  if (import.meta.env.DEV && !runHydration) {
    throw Error(`[saus] "onHydrate" must be called before "hydrate"`)
  }
  routes[props.routePath] = routeModuleUrl
  const path = location.pathname
  globalCache.loaded[path] = [props]
  await runHydration({
    path,
    file: getPageFilename(path, import.meta.env.BASE_URL),
    query: location.search.slice(1),
    params: props.routeParams,
    module: routeModule,
    props,
  })
  saus.hydrated = true
}

// TODO: support multiple hydration handlers
export function onHydrate(hydrate: HydrateFn) {
  runHydration = hydrate
}
