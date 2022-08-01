import { onResponse, setup } from 'saus'
import {
  AssetStore,
  assignDefaults,
  Endpoint,
  getPageFilename,
  getRequestMetadata,
  injectCachePlugin,
  ParsedUrl,
  parseUrl,
  pick,
} from 'saus/core'
import {
  normalizeHeaders,
  RequestHeaders,
  ResponseHeaders,
  unwrapBody,
} from 'saus/http'

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
    if (env.command !== 'bundle' || process.env['NODE_ENV'] !== 'production') {
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

    const shouldSkipResponse = (
      req: Endpoint.Request,
      res: Endpoint.Response
    ): boolean =>
      res.status !== 200 ||
      !res.body ||
      !!res.body.stream ||
      !res.route ||
      res.route == app.defaultRoute ||
      res.route == app.catchRoute ||
      !!(config.skipAuthorized && req.headers['authorization'])

    onResponse(1e9, (req, res) => {
      if (shouldSkipResponse(req, res)) {
        return
      }
      const headers = resolveHeaders(req, res.headers.toJSON() || {})
      const body = unwrapBody(res.body!) as string | Buffer
      // Someone visited a page through client-side routing.
      if (req.path.endsWith('.html.js')) {
        config.store.put(req.path.slice(1), body, headers)
      }
      // Someone visited a page through external link.
      else if (res.headers.has('content-type', /^text\/html\b/)) {
        const { page } = getRequestMetadata(req)
        if (!page) {
          return // HTML not rendered with Saus.
        }

        const file = getPageFilename(req.path)

        config.store.put(file, body, headers)
        config.store.put(file + '.js', app.renderPageState(page), headers)
      }
    })

    if (config.routes?.purge) {
      addPurgeRoute(config.routes.purge, config.store)
    }
  })
}
