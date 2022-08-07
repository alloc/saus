import { Cache } from '@/runtime/cache/types'
import { App, RenderPageResult } from './types'

export function cachePages(
  maxAge: number,
  pageCache: Cache<RenderPageResult>
): App.Plugin {
  return app => {
    const { renderPage } = app

    return {
      renderPage: (url, route, options) =>
        pageCache.load(url.path, async cacheControl => {
          const page = await renderPage(url, route, options)
          cacheControl.maxAge = maxAge
          return page
        }),
    }
  }
}
