import { getCachedState } from '../runtime/getCachedState'
import { AppWrapper } from './createApp'

export function cacheClientState(maxAge: number): AppWrapper {
  return app => {
    const { loadClientState } = app

    return {
      loadClientState: (url, route) =>
        getCachedState(url.path, async cacheControl => {
          const state = await loadClientState(url, route)
          cacheControl.maxAge = maxAge
          return state
        }),
    }
  }
}
