import { SausContext } from '../context'
import { createPageFactory, PageFactory } from '../render'
import { defer } from '../utils/defer'
import { Plugin } from '../vite'

export function servePlugin(context: SausContext): Plugin {
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
      server.middlewares.use((req, res, next) => {
        const path = req.originalUrl!
        init.then(() =>
          pageFactory.renderPath(path, async (error, page) => {
            if (page) {
              const html = await server.transformIndexHtml(path, page.html)
              res.setHeader('Content-Type', 'text/html')
              res.setHeader('Content-Length', Buffer.byteLength(html))
              res.writeHead(200)
              res.write(html)
              res.end()
            } else {
              next(error)
            }
          })
        )
      }),
  }
}
