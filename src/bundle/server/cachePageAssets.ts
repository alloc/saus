import type { App } from '../../app/types'
import { Headers, normalizeHeaders } from '../../http'
import { onResponse } from '../../routes'
import { prependBase } from '../../utils/base'
import { pick } from '../../utils/pick'
import config from '../runtimeConfig'
import type { PageBundle } from '../types'
import type { FileCache } from './fileCache'

/**
 * In addition to the returned `App` plugin, this function also adds
 * a response hook with a priority of `1,000`. You should avoid mutating
 * response headers from a response hook with a higher priority.
 */
export const cachePageAssets = (cache: FileCache): App.Plugin => {
  const assetBase = `/${config.assetsDir}/`
  const assetDebugBase =
    config.debugBase && prependBase(assetBase, config.debugBase)
  const isAsset = (url: string) =>
    url.startsWith(assetBase) ||
    (assetDebugBase && url.startsWith(assetDebugBase))

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
          pick(
            headers,
            ['cache-control', 'cdn-cache-control', 'expires'],
            Boolean
          )

        const getHeaders = (url: string) => {
          if (url.endsWith('.html.js')) {
            const headers = pageCacheRules && { ...pageCacheRules }

            // If the Expires header exists, use it to refresh the max-age and
            // s-maxage values in the Cache-Control and CDN-Cache-Control headers.
            if (headers?.expires) {
              const expires = new Date(headers.expires)
              const maxAge = Math.floor((expires.getTime() - Date.now()) / 1e3)
              const replaceMaxAge = (key: keyof typeof headers) => {
                headers[key] &&= (headers[key] as string).replace(
                  /\b(max-?age=)\d+/,
                  (_, $1) => $1 + maxAge
                )
              }
              replaceMaxAge('cache-control')
              replaceMaxAge('cdn-cache-control')
            }

            return headers
          }
          if (isAsset(url)) {
            return assetCacheRules
          }
        }

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
