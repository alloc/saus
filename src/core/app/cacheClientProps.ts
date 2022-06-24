import { getCachedState } from '../runtime/getCachedState'
import { App } from './types'

export function cacheClientProps(maxAge: number): App.Plugin {
  return app => {
    const { loadClientProps } = app

    return {
      loadClientProps: (url, route) =>
        getCachedState(url.path, async cacheControl => {
          const props = await loadClientProps(url, route)
          cacheControl.maxAge = maxAge
          return props
        }),
    }
  }
}
