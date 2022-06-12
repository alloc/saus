import etag from 'etag'
import { Endpoint } from '../core/endpoint'
import { ModuleRenderer } from '../core/getModuleRenderer'
import { makeRequestUrl } from '../core/makeRequest'
import type { Route } from '../core/routes'
import type { Headers } from '../http'
import { route } from '../routes'
import { globalCache } from '../runtime/cache'
import { getCachedState } from '../runtime/getCachedState'
import { stateModulesById } from '../runtime/stateModules'
import { prependBase } from '../utils/base'
import { defer } from '../utils/defer'
import { ParsedUrl, parseUrl } from '../utils/url'
import type { App, AppContext, RenderPageResult } from './types'

const indexFileRE = /(^|\/)index$/

export function defineBuiltinRoutes(
  context: AppContext,
  renderer: ModuleRenderer
) {
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
    const [, route] = app.resolveRoute(
      makeRequestUrl(pageUrl, 'GET', { accept: 'text/html' })
    )
    if (route) {
      const [page, error] = await renderPage(pageUrl, route, app)

      if (error) {
        const props = { message: error.message, stack: error.stack }
        const module = `throw Object.assign(Error(), ${JSON.stringify(props)})`
        sendModule(req, module)
      } else if (page?.props) {
        const module = renderer.renderPageState(page, context.helpersId)
        sendModule(req, module)
      }
    }
  })

  // State modules
  route(`${context.config.stateModuleBase}*.js`)
    .get(async req => {
      const stateModuleId = req.wild
      await getCachedState(stateModuleId, globalCache.loaders[stateModuleId])

      const stateEntry = globalCache.loaded[stateModuleId]
      if (stateEntry) {
        const module = renderer.renderStateModule(stateModuleId, stateEntry)
        sendModule(req, module)
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
