import { prependBase } from '@utils/base'
import { defer } from '@utils/defer'
import { murmurHash } from '@utils/murmur3'
import etag from 'etag'
import { toExpiresHeader } from '../../cache/expiration'
import { stateModulesByName } from '../../cache/global'
import type { Cache } from '../../cache/types'
import { Endpoint } from '../../endpoint'
import type { Http } from '../../http'
import { makeRequestUrl } from '../../makeRequest'
import { setRequestMetadata } from '../../requestMetadata'
import { route } from '../../routeHooks'
import type { Route } from '../../routeTypes'
import { serveCache, serveState } from '../../stateModules/serve'
import { ParsedUrl, parseUrl } from '../../url'
import { collectStateFiles } from '../collectStateFiles'
import type { App, RenderPageResult } from '../types'

const indexFileRE = /(^|\/)index$/

export function defineBuiltinRoutes(app: App, context: App.Context) {
  const { debugBase } = context.config
  const isBundle = context.config.command == 'bundle'

  const renderPage = async (
    url: ParsedUrl,
    route: Route
  ): Promise<RenderPageResult> => {
    if (isBundle) {
      const { resolve, promise } = defer<RenderPageResult>()

      // Use the `renderPageBundle` method so any related modules/assets
      // can be cached by the `cachePageAssets` plugin.
      const rendering = app.renderPageBundle(url, route, {
        receivePage: (...args) => resolve(args),
      })

      rendering.catch(e => resolve([null, e]))
      return promise
    }
    return app.renderPage(url, route)
  }

  // Page-based entry modules
  route(`/*.html.js`).get(async req => {
    const pagePath = '/' + req.wild.replace(indexFileRE, '')
    const pageUrl = parseUrl(
      debugBase && req.startsWith(debugBase)
        ? prependBase(pagePath, debugBase)
        : pagePath
    )
    const { route } = app.resolveRoute(
      makeRequestUrl(pageUrl, {
        headers: { accept: 'text/html' },
      })
    )
    if (route) {
      const [page, error] = await renderPage(pageUrl, route)

      if (error) {
        const props = { message: error.message, stack: error.stack }
        const module = `throw Object.assign(Error(), ${JSON.stringify(props)})`
        sendModule(req, module, {
          'cache-control': 'no-store',
        })
      } else if (page?.props) {
        setRequestMetadata(req, { page })
        collectStateFiles(page.files, page.props._included, app)

        const module = app.renderPageState(page)
        sendModule(req, module, {
          expires: toExpiresHeader(page.props._ts, page.props._maxAge),
        })
      }
    }
  })

  // State modules (non-hydrated)
  route(`${context.config.stateModuleBase}*.js`).get(async req => {
    const cacheKey = req.wild
    const [name, hash] = parseStateModuleKey(cacheKey)!

    const stateModule = stateModulesByName.get(name)
    if (stateModule) {
      let promise = serveCache.access(cacheKey) as
        | Promise<Cache.Entry>
        | undefined
      if (!promise) {
        let args: any = req.headers['x-args']
        if (!args) {
          return req.respondWith(404)
        }
        args = Buffer.from(args, 'base64').toString()
        if (hash !== murmurHash(args)) {
          return req.respondWith(400, {
            json: { message: 'x-args hash mismatch' },
          })
        }
        args = JSON.parse(args)
        promise = serveState(stateModule, {
          args,
          deepCopy: false,
        })
      }
      const entry = await promise
      if (entry) {
        if (Array.isArray(entry.args)) {
          const module = app.renderStateModule(name, entry)
          return sendModule(req, module, {
            expires: toExpiresHeader(entry.timestamp, entry.maxAge),
          })
        }
        console.warn(
          'Cannot render a state module without its arguments: ' + cacheKey
        )
      }
      req.respondWith(404)
    }
  })

  // Ensure a state module is generated.
  route('/.saus/state').post(async req => {
    const [id, args] = await req.json<[string, any[]]>()
    const stateModule = stateModulesByName.get(id)
    if (stateModule) {
      await stateModule.load(...args)
      req.respondWith(200)
    }
  })
}

const sendModule = (
  req: Endpoint.Request,
  text: string,
  headers?: Http.ResponseHeaders
) =>
  req.respondWith(200, {
    text,
    headers: {
      ...headers,
      'content-type': 'application/javascript',
      etag: etag(text, { weak: true }),
    },
  })

const parseStateModuleKey = (key: string) => {
  const match = /^(.+?)(?:\.([^.]+))?$/.exec(key)!
  return [match[1], +match[2]] as [id: string, hash: number]
}
