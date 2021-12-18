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
 * The `url` must not contain either a hash fragment (eg: `#foo`) or
 * search query (eg: `?foo`).
 */
function loadClientState(url: string): Promise<ClientState> {
  let state = states[url]
  if (!state && typeof fetch !== 'undefined') {
    const stateUrl = url.replace(/\/?$/, '/state.json')
    state = states[url] = fetch(stateUrl).then(res => res.json())
  }
  return state
}

export { initialState, loadClientState }
export type { ClientState }

export interface StateIsolate<T = any> {
  /** Call this (and await its promise) **before** rendering the page. */
  load: () => Promise<T>
  get: 
}

/**
 * State isolates are loaded at compile time. Their loader function receives the
 * top-level state for the current page route. They are stored within the hydration
 * JSON state using a globally unique identifier.
 */
export function defineStateIsolate<T>(
  guid: string,
  load: (state: Record<string, any>) => T
) {}

type UnwrapIsolateProps<T> = {
  [P in keyof T]: T[P]
}
