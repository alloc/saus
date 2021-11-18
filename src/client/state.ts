import type { ClientState } from '../core'
import { states } from './cache'

let initialState: ClientState

declare const document: { querySelector: (selector: string) => any }

if (!import.meta.env.SSR) {
  const stateScript = document.querySelector('#initial-state')
  initialState = JSON.parse(stateScript.textContent)
  stateScript.remove()

  const pageUrl =
    location.pathname.slice(import.meta.env.BASE_URL.length - 1) +
    location.search

  states[pageUrl] = Promise.resolve(initialState)
}

/**
 * Load client state for the given URL, using the local cache if possible.
 *
 * The `url` cannot contain a hash fragment. Search queries are okay.
 *
 * Before appending a search query, use `URLSearchParams#sort` to ensure
 * the query params are idempotent regardless of order.
 */
function loadClientState(url: string): Promise<ClientState> {
  let state = states[url]
  if (!state) {
    const stateUrl = url.replace(/(\?.+)?$/, '/state.json$1')
    state = states[url] = fetch(stateUrl).then(res => res.json())
  }
  return state
}

export { initialState, loadClientState }
export type { ClientState }
