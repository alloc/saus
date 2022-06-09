import etag from 'etag'
import { Endpoint } from '../core/endpoint'
import { ModuleRenderer } from '../core/getModuleRenderer'
import { makeRequestUrl } from '../core/makeRequest'
import type { Headers } from '../http'
import { route } from '../routes'
import { globalCache } from '../runtime/cache'
import { getCachedState } from '../runtime/getCachedState'
import { stateModulesById } from '../runtime/stateModules'
import { parseUrl } from '../utils/url'
import type { AppContext } from './types'

const indexFileRE = /(^|\/)index$/

export function defineBuiltinRoutes(
  context: AppContext,
  renderer: ModuleRenderer
) {
  // Page-based entry modules
  route(`/*.html.js`).get(async (req, app) => {
    const pagePath = '/' + req.wild.replace(indexFileRE, '')
    const pageUrl = parseUrl(pagePath)
    const [, route] = app.resolveRoute(
      makeRequestUrl(pageUrl, 'GET', { accept: 'text/html' })
    )
    if (route) {
      const [page, error] = await app.renderPage(pageUrl, route)

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
  req.respondWith(200, makeModuleHeaders(text), { text })

const makeModuleHeaders = (text: string): Headers => ({
  'Content-Type': 'application/javascript',
  ETag: etag(text, { weak: true }),
})
