import { globalCache } from '@/runtime/cache'
import { App } from './types'

export function cacheClientProps(maxAge: number): App.Plugin {
  return app => {
    const { loadPageProps } = app

    return {
      loadPageProps: (url, route) =>
        globalCache.load(url.path, async cacheControl => {
          const props = await loadPageProps(url, route)
          cacheControl.maxAge = maxAge
          return props
        }),
    }
  }
}
