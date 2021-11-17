import type { ClientState } from '../core'
import { states } from './cache'

let initialState: ClientState

const loadClientState = (url: string): Promise<ClientState> =>
  (states[url] ||= fetch(url + '/state.json').then(res => res.json()))

declare const document: { querySelector: (selector: string) => any }

if (!import.meta.env.SSR) {
  const stateScript = document.querySelector('#initial-state')
  initialState = JSON.parse(stateScript.textContent)
  stateScript.remove()

  const baseUrl = import.meta.env.BASE_URL
  const pageUrl = location.pathname.slice(baseUrl.length - 1)
  states[pageUrl] = Promise.resolve(initialState)
}

export { initialState, loadClientState }
export type { ClientState }
