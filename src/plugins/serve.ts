import { SausContext } from '../context'
import { createPageFactory, PageFactory } from '../render'
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

type Deferred<T> = PromiseLike<T> & {
  resolve: T extends void ? () => void : (value: T) => void
}

function defer<T>() {
  const result = {} as Deferred<T>
  const promise = new Promise(resolve => {
    result.resolve = resolve as any
  })
  result.then = promise.then.bind(promise) as any
  return result
}
