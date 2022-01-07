import type { ClientState } from '../core'
import { loadedStateCache } from './cache'
import { unpackStateFragments } from './unpack'

export let initialState: ClientState

if (!import.meta.env.SSR) {
  const stateScript = document.querySelector('#initial-state')!
  initialState = JSON.parse(stateScript.textContent!)
  stateScript.remove()

  const pageUrl =
    location.pathname.slice(import.meta.env.BASE_URL.length - 1) +
    location.search

  loadedStateCache.set(pageUrl, initialState)
  unpackStateFragments(initialState)
}
