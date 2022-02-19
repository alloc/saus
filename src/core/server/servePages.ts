import { gray } from 'kleur/colors'
import type { ClientModule, default as RenderPage } from '../../bundle/types'
import { connect } from './connect'
import { debug } from './debug'

export const servePages = (
  renderPage: typeof RenderPage,
  addModule: (module: ClientModule) => void
) =>
  async function servePage(
    req: connect.Request,
    res: connect.Response,
    next: connect.NextFunction
  ) {
    try {
      const page = await renderPage(req.url)
      if (!page) {
        return next()
      }
      debug(gray('rendered'), req.url)
      page.modules.forEach(addModule)
      page.assets.forEach(addModule)
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
