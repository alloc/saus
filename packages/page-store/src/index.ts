import { onResponse, route, setup } from 'saus'
import {
  AssetStore,
  assignDefaults,
  getPageFilename,
  getRequestMetadata,
  injectCachePlugin,
  ParsedUrl,
  parseUrl,
  pick,
  unwrapBody,
} from 'saus/core'
import { normalizeHeaders, RequestHeaders, ResponseHeaders } from 'saus/http'

export type PageRuleContext = ParsedUrl & {
  headers: Readonly<RequestHeaders>
}

export interface PageRule {
  pathPattern: RegExp
  headers: (req: PageRuleContext) => ResponseHeaders
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
  setup(env => app => {
    if (env.command !== 'bundle') {
      return // Disabled in development.
    }

    const resolveHeaders = (
      req: PageRuleContext,
      headers: ResponseHeaders = {}
    ) => {
      const pageRules = config.pageRules?.filter(rule =>
        rule.pathPattern.test(req.path)
      )
      if (pageRules?.length) {
        pageRules.forEach(rule => {
          assignDefaults(headers, rule.headers(req))
        })
      }
      headers = normalizeHeaders(headers)
      if (config.store.supportedHeaders) {
        headers = pick(headers, config.store.supportedHeaders)
      }
      return headers
    }

    injectCachePlugin({
      put(name, state, expiresAt) {
        const req = parseUrl(
          env.stateModuleBase + name + '.js'
        ) as PageRuleContext
        req.headers = {}

        return config.store.put(
          req.path.slice(1),
          app.renderStateModule(name, [state, expiresAt]),
          resolveHeaders(req)
        )
      },
    })

    onResponse(1e9, (req, res) => {
      if (!res.ok) {
        return // Skip failed responses.
      }
      if (config.skipAuthorized && req.headers['authorization']) {
        return // Skip authorized requests.
      }
      if (res.body && res.headers.has('content-type', /^text\/html\b/)) {
        if ('stream' in res.body) {
          return // HTML streams are not supported.
        }

        const { page } = getRequestMetadata(req)
        if (!page) {
          return // HTML not rendered with Saus.
        }

        const file = getPageFilename(req.path)
        const headers = resolveHeaders(req, res.headers.toJSON() || {})

        config.store.put(file, unwrapBody(res.body) as string, headers)
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
