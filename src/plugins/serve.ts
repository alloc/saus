import { Plugin, SausContext } from '../core'
import { createPageFactory, PageFactory } from '../pages'
import { defer } from '../utils/defer'

export function servePlugin(
  context: SausContext,
  onError: (e: any) => void
): Plugin {
  // The server starts before Saus is ready, so we stall
  // any early page requests until it is.
  let init = defer<void>()
  let pageFactory: PageFactory

  return {
    name: 'saus:serve',
    contextUpdate(context) {
      pageFactory = createPageFactory(context)
      init.resolve()
    },
    configureServer: server => () =>
      server.middlewares.use(async (req, res, next) => {
        const path = req.originalUrl!
        await Promise.all([init, context.reloading])
        await pageFactory.resolvePage(path, async (error, page) => {
          if (page) {
            const html = await server.transformIndexHtml(path, page.html)
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.setHeader('Content-Length', Buffer.byteLength(html))
            res.writeHead(200)
            res.write(html)
            res.end()
          } else if (error) {
            onError(error)
            res.writeHead(500)
            res.end()
          } else {
            next()
          }
        })
      }),
  }
}
