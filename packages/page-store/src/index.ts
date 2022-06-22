import { onResponse, route } from 'saus'
import {
  AssetStore,
  Endpoint,
  getPageFilename,
  getRequestMetadata,
  setup,
  toRawBody,
} from 'saus/core'
import { ResponseHeaders } from 'saus/http'

export interface PageStoreConfig {
  store: AssetStore
  routes?: {
    /**
     * Leave this undefined if you don't plan to purge files
     * by sending a request to this route.
     */
    purge?: string
  }
  skipAuthorized?: boolean
  /**
   * Define headers to be stored alongside the file associated
   * with the given request.
   */
  headers?: (req: Endpoint.Request) => ResponseHeaders
}

export function setupPageStore(config: PageStoreConfig) {
  setup(env => {
    if (env.command !== 'bundle') {
      return // Disabled in development.
    }

    onResponse(1e9, (req, res, app) => {
      if (!res.ok) {
        return // Skip failed responses.
      }
      if (config.skipAuthorized && req.headers['authorization']) {
        return // Skip authorized requests.
      }
      if (res.body && res.headers.has('content-type', /^text\/html\b/)) {
        const html = toRawBody(res.body)
        if (!html) {
          return // HTML streams are not supported.
        }
        const { page } = getRequestMetadata(req)
        if (!page) {
          return // HTML not rendered with Saus.
        }
        const file = getPageFilename(req.path)
        const headers = config.headers?.(req)
        config.store.put(file, html, headers)
        config.store.put(file + '.js', app.renderPageState(page), headers)
      }
    })

    if (config.routes?.purge) {
      type PurgePayload = { paths: string[] }
      route(config.routes.purge).post(async req => {
        const { paths } = await req.json<PurgePayload>()
        if (!Array.isArray(paths)) {
          return req.respondWith(400, {
            json: { error: 'Missing "paths" array parameter' },
          })
        }
        const deleting: Promise<void>[] = []
        for (const path of paths) {
          const file = getPageFilename(path)
          for (const suffix of ['', '.js']) {
            deleting.push(config.store.delete(file + suffix))
          }
        }
        await Promise.all(deleting)
        req.respondWith(200)
      })
    }
  })
}
