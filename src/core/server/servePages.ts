import { gray } from 'kleur/colors'
import type { default as RenderPage } from '../../bundle/main'
import { connect } from './connect'
import { debug } from './debug'
import { FileCache } from './fileCache'

export const servePages = (
  renderPage: typeof RenderPage,
  cache: FileCache
): connect.Middleware =>
  async function servePage(req, res, next) {
    try {
      const page = await renderPage(req.url)
      if (!page) {
        return next()
      }
      debug(gray('rendered'), req.url)
      cache.addModules(page.modules)
      cache.addAssets(page.assets)
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
