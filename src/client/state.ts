import type { RouteParams } from '../routes'
import type { ClientState } from '../context'

let state: ClientState

declare const document: { querySelector: (selector: string) => any }

if (!import.meta.env.SSR) {
  const stateContainer = document.querySelector('#initial-state')
  state = JSON.parse(stateContainer.textContent)
  stateContainer.remove()
}

export { state }
export type { ClientState, RouteParams }
