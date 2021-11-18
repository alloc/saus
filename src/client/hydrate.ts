import type { RenderRequest } from '../core'
import { initialState as state } from './state'
import routes from './routes'

const urlPathRegex = /^(.+?)(?:#[^?]*)?(?:\?(.*))?$/

export type HydrateFn = (routeModule: any, request: RenderRequest) => void

let runHydration: HydrateFn

export function hydrate(routeModule: object, url: string) {
  if (import.meta.env.DEV && !runHydration) {
    throw Error(`[saus] "onHydrate" must be called before "hydrate"`)
  }
  routes[state.routePath] = async () => routeModule
  const [, path, query] = urlPathRegex.exec(url)!
  runHydration(routeModule, {
    path,
    query,
    params: state.routeParams,
    state,
  })
}

// TODO: support multiple hydration handlers
export function onHydrate(hydrate: HydrateFn) {
  runHydration = hydrate
}
