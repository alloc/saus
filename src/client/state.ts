import type { RouteModule, RouteParams } from '../routes'
import type { ClientState } from '../context'

let state: ClientState
let initialRoute: Promise<RouteModule>

declare const document: { querySelector: (selector: string) => any }

if (!import.meta.env.SSR) {
  const stateContainer = document.querySelector('#initial-state')
  stateContainer.remove()

  state = JSON.parse(stateContainer.textContent)
  initialRoute = import(/* @vite-ignore */ state.routeModuleId)
}

export { state, initialRoute }
export type { ClientState, RouteModule, RouteParams }
