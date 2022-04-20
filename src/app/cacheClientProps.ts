import { getCachedState } from '../runtime/getCachedState'
import { AppWrapper } from './createApp'

export function cacheClientProps(maxAge: number): AppWrapper {
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
