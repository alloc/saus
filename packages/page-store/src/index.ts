import { onResponse, route, setup } from 'saus'
import {
  AssetStore,
  assignDefaults,
  Endpoint,
  getPageFilename,
  getRequestMetadata,
  pick,
  toRawBody,
} from 'saus/core'
import { ResponseHeaders } from 'saus/http'

export interface PageRule {
  pathPattern: RegExp
  headers: (req: Endpoint.Request) => ResponseHeaders
}

export interface PageStoreConfig {
  store: AssetStore
  routes?: {
    /**
     * Leave this undefined if you don't plan to purge files
     * by sending a POST request to this route.
     */
    purge?: string
  }
  skipAuthorized?: boolean
  pageRules?: PageRule[]
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

        let headers = res.headers.toJSON() || {}
        if (config.store.supportedHeaders) {
          headers = pick(headers, config.store.supportedHeaders)
        }

        const pageRules = config.pageRules?.filter(rule =>
          rule.pathPattern.test(req.path)
        )
        if (pageRules?.length) {
          pageRules.forEach(rule => {
            assignDefaults(headers, rule.headers)
          })
        }

        const file = getPageFilename(req.path)
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
