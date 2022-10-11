import { App } from './types'

export function cacheClientProps(maxAge: number): App.Plugin {
  return app => {
    const { loadPageProps } = app

    return {
      loadPageProps: (url, route) =>
        app.cache.load(url.path, async cacheControl => {
          const props = await loadPageProps(url, route)
          cacheControl.maxAge = maxAge
          return props
        }),
    }
  }
}
