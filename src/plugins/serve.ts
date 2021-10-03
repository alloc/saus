import { SausContext } from '../context'
import { createPageFactory, PageFactory } from '../render'
import { Plugin } from '../vite'

export function servePlugin(context: SausContext): Plugin {
  let pageFactory: PageFactory

  return {
    name: 'saus:serve',
    contextUpdate(context) {
      pageFactory = createPageFactory(context)
    },
    configureServer(server) {
      pageFactory = createPageFactory(context)
      return () =>
        server.middlewares.use((req, res, next) => {
          const path = req.originalUrl!
          pageFactory.renderPath(path, async (error, page) => {
            if (page) {
              const html = await server.transformIndexHtml(path, page.html)
              res.writeHead(200)
              res.write(html)
              res.end()
            } else {
              next(error)
            }
          })
        })
    },
  }
}
