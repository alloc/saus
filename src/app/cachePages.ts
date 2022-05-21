import { CacheControl } from '../core/withCache'
import { App } from './createApp'
import { RenderPageResult } from './types'

export function cachePages(
  maxAge: number,
  getCachedPage: (
    key: string,
    loader: (cacheControl: CacheControl) => Promise<RenderPageResult | null>
  ) => Promise<RenderPageResult>
): App.Plugin {
  return app => {
    const { renderPage } = app

    return {
      renderPage: (url, route, options) =>
        getCachedPage(
          typeof url == 'string' ? url : url.path,
          async cacheControl => {
            const page = await renderPage(url, route, options)
            cacheControl.maxAge = maxAge
            return page
          }
        ),
    }
  }
}
