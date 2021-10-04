import { state, ClientState, RouteModule } from './state'
import routes from './routes'

export type HydrateFn = (routeModule: RouteModule, state: ClientState) => void

let runHydration: HydrateFn

export function hydrate(routeModule: RouteModule, nextState?: ClientState) {
  if (nextState) Object.assign(state, nextState)
  const promise = (state.routePromise = Promise.resolve(routeModule))
  routes[state.routePath] = () => promise
  runHydration(routeModule, state)
}

// TODO: support multiple hydration handlers
export function onHydrate(hydrate: HydrateFn) {
  runHydration = hydrate
}
