import { onResponse, setup } from 'saus'
import {
  AssetStore,
  Endpoint,
  getRequestMetadata,
  ParsedUrl,
  parseUrl,
} from 'saus/core'
import { normalizeHeaders, unwrapBody } from 'saus/http'
import { unwrapBuffer } from 'saus/node/buffer'
import { assignDefaults } from 'saus/utils/assignDefaults'
import { getPageFilename } from 'saus/utils/getPageFilename'
import { pick } from 'saus/utils/pick'

export type PageRuleContext = ParsedUrl & {
  headers: Readonly<Http.RequestHeaders>
}

export interface PageRule {
  pathPattern: RegExp
  headers: (req: PageRuleContext) => Http.ResponseHeaders
}

export interface PageStoreConfig {
  store: AssetStore
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
      headers: Http.ResponseHeaders = {}
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

      const { page } = getRequestMetadata(req)
      if (!page) {
        return // HTML not rendered with Saus.
      }

      const headers = resolveHeaders(req, res.headers.toJSON() || {})
      const body = unwrapBody(res.body!) as string | Buffer
      const file = req.path.endsWith('.html.js')
        ? req.path.slice(1)
        : res.headers.has('content-type', /^text\/html\b/)
        ? getPageFilename(req.path)
        : null

      if (!file) {
        // By default, only .html.js and page requests have the `page`
        // metadata property set on their request, but nothing will stop
        // another package or the user from setting it.
        return
      }

      return Promise.all([
        config.store.put(file, body, headers),
        ...page.files
          .filter(file => !file.wasCached)
          .map(file => {
            const fileReq = parseUrl(file.id) as PageRuleContext
            fileReq.headers = {}

            const expiresAt = Number(file.expiresAt)
            const headers = resolveHeaders(fileReq, {
              'content-type': file.mime,
              expires: isFinite(expiresAt)
                ? new Date(expiresAt).toUTCString()
                : undefined,
            })

            return config.store.put(
              file.id.slice(1),
              unwrapBuffer(file.data),
              headers
            )
          }),
      ]) as Promise<any>
    })
  })
}
