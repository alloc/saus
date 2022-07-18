import { Endpoint } from '@/endpoint'
import type { Headers } from '@/http'
import { makeRequestUrl } from '@/makeRequest'
import { ParsedUrl, parseUrl } from '@/node/url'
import type { Route } from '@/routes'
import { globalCache } from '@/runtime/cache'
import { CachePlugin } from '@/runtime/cachePlugin'
import { getCachedState } from '@/runtime/getCachedState'
import { route } from '@/runtime/routes'
import { stateModulesById } from '@/runtime/stateModules'
import { prependBase } from '@/utils/base'
import { defer } from '@/utils/defer'
import etag from 'etag'
import type { App, RenderPageResult } from '../types'

const indexFileRE = /(^|\/)index$/

export function defineBuiltinRoutes(app: App, context: App.Context) {
  const { debugBase } = context.config
  const isBundle = context.config.command == 'bundle'

  const renderPage = async (
    url: ParsedUrl,
    route: Route,
    app: App
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
  route(`/*.html.js`).get(async (req, _, app) => {
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
      const [page, error] = await renderPage(pageUrl, route, app)

      if (error) {
        const props = { message: error.message, stack: error.stack }
        const module = `throw Object.assign(Error(), ${JSON.stringify(props)})`
        sendModule(req, module)
      } else if (page?.props) {
        const module = app.renderPageState(page)
        sendModule(req, module)
      }
    }
  })

  // State modules
  route(`${context.config.stateModuleBase}*.js`)
    .get(async req => {
      const cacheKey = req.wild
      const id = cacheKey.replace(/\.[^.]+$/, '')

      const stateModule = stateModulesById.get(id)
      if (stateModule) {
        await getCachedState(cacheKey, async cacheControl => {
          let result: any
          if (CachePlugin.loader) {
            result = await CachePlugin.loader(cacheKey, cacheControl)
          }
          if (result !== undefined) {
            return result
          }
          const loader = globalCache.loaders[cacheKey]
          if (loader) {
            return loader(cacheControl)
          }
          cacheControl.maxAge = 0
        })

        const stateEntry = globalCache.loaded[cacheKey]
        if (stateEntry) {
          const module = app.renderStateModule(cacheKey, stateEntry)
          sendModule(req, module)
        }
      }
    })
    // Ensure a state module is generated.
    .post(async req => {
      const input = (await req.read()).toString('utf8')
      const [id, args] = JSON.parse(input) as [string, any[]]

      const stateModule = stateModulesById.get(id)
      if (stateModule) {
        await stateModule.load(...args)
        req.respondWith(200)
      }
    })
}

const sendModule = (req: Endpoint.Request, text: string) =>
  req.respondWith(200, { text, headers: makeModuleHeaders(text) })

const makeModuleHeaders = (text: string): Headers => ({
  'content-type': 'application/javascript',
  etag: etag(text, { weak: true }),
})
