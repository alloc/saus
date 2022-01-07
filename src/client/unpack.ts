import type { ClientState } from '../core'
import { loadedStateCache } from './cache'

export function unpackStateFragments(state: ClientState) {
  if (state.$) {
    for (const [prefix, calls] of Object.entries(state.$)) {
      for (const [call, state] of Object.entries(calls)) {
        loadedStateCache.set(prefix + ';' + call, state)
      }
    }
    delete state.$
  }
}
