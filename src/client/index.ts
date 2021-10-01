/// <reference types="vite/client" />
import type { ClientState, RouteModule, RouteParams } from '../context'
import routes from './routes'

declare const document: { querySelector: (selector: string) => any }

let state: ClientState
let initialRoute: Promise<RouteModule>

if (!import.meta.env.SSR) {
  const stateContainer = document.querySelector('#stite_DATA')
  stateContainer.remove()

  state = JSON.parse(stateContainer.textContent)
  initialRoute = import(state.routeModuleId /* @vite-ignore */)
}

export { state, routes, initialRoute }
export type { ClientState, RouteModule, RouteParams }
