import type { App } from '../../app/types'
import { Headers, normalizeHeaders } from '../../http'
import { onResponse } from '../../routes'
import { pick } from '../../utils/pick'
import type { PageBundle } from '../types'
import type { FileCache } from './fileCache'

/**
 * In addition to the returned `App` plugin, this function also adds
 * a response hook with a priority of `1,000`. You should avoid mutating
 * response headers from a response hook with a higher priority.
 */
export const cachePageAssets = (cache: FileCache): App.Plugin => {
  // Assets produced by Rollup have a content hash,
  // so the browser can cache them for longer periods.
  const assetMaxAge = 2629800 // 1 month
  const assetCacheRules: Headers = normalizeHeaders(
    { 'cache-control': 'public, max-age=' + assetMaxAge },
    true
  )

  const recentPages = new Map<string, PageBundle>()
  onResponse(1e3, (req, [status, headers]) => {
    if (status == 200) {
      const page = recentPages.get(req.path)
      if (page) {
        recentPages.delete(req.path)

        const pageCacheRules =
          headers &&
          pick(headers, ['cache-control', 'cdn-cache-control'], Boolean)

        const getHeaders = (url: string) =>
          url.endsWith('.html.js')
            ? pageCacheRules
            : url.startsWith('/assets/')
            ? assetCacheRules
            : null

        cache.addModules(page.modules, getHeaders)
        cache.addAssets(page.assets, getHeaders)
      }
    }
  })

  return ({ renderPageBundle }) => ({
    async renderPageBundle(url, route, options) {
      const page = await renderPageBundle(url, route, options)
      if (page) {
        recentPages.set(url.path, page)
      }
      return page
    },
  })
}
