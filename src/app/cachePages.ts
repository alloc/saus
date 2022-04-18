import { CacheControl } from '../core/withCache'
import { AppWrapper } from './createApp'
import { RenderPageResult } from './types'

export function cachePages(
  maxAge: number,
  getCachedPage: (
    key: string,
    loader: (cacheControl: CacheControl) => Promise<RenderPageResult | null>
  ) => Promise<RenderPageResult | null>
): AppWrapper {
  return app => {
    const { renderPage } = app

    return {
      renderPage: (url, options) =>
        getCachedPage(
          typeof url == 'string' ? url : url.path,
          async cacheControl => {
            const page = await renderPage(url, options)
            cacheControl.maxAge = maxAge
            return page
          }
        ),
    }
  }
}
