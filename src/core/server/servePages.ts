import { gray } from 'kleur/colors'
import type { default as RenderPage } from '../../bundle/main'
import { connect } from './connect'
import { debug } from './debug'
import { ModuleCache } from './moduleCache'

export const servePages = (
  renderPage: typeof RenderPage,
  moduleCache: ModuleCache
): connect.Middleware =>
  async function servePage(req, res, next) {
    try {
      const page = await renderPage(req.url)
      if (!page) {
        return next()
      }
      debug(gray('rendered'), req.url)
      page.modules.forEach(moduleCache.add)
      page.assets.forEach(moduleCache.add)
      res.writeHead(200, {
        'Content-Type': 'text/html',
      })
      res.write(page.html)
      return res.end()
    } catch (error) {
      // Renderer threw an unexpected error.
      console.error(error)
      res.writeHead(500)
      res.end()
    }
  }
