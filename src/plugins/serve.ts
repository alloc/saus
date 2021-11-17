import createDebug from 'debug'
import { Plugin, SausContext } from '../core'
import { createPageFactory, PageFactory } from '../pages'
import { defer } from '../utils/defer'

const debug = createDebug('saus:serve')

const stateSuffix = '/state.json'

type Promisable<T> = T | PromiseLike<T>

export function servePlugin(
  context: SausContext,
  onError: (e: any) => void
): Plugin {
  // The server starts before Saus is ready, so we stall
  // any early page requests until it is.
  let init = defer<void>()
  let pageFactory: PageFactory
  let requestQueue = Promise.resolve()

  function handleRequest(action: () => Promisable<void>) {
    const promise = requestQueue
      .then(() => Promise.all([init, context.reloading]))
      .then(action)
    requestQueue = promise.catch(() => {})
    return promise
  }

  async function getState(pageUrl: string) {
    await requestQueue
    let state = await pageFactory.getState(pageUrl)
    if (!state) {
      await handleRequest(() =>
        pageFactory.resolvePage(pageUrl, (_, page) => {
          if (page) {
            state = page.state
          }
        })
      )
    }
    return state
  }

  return {
    name: 'saus:serve',
    contextUpdate(context) {
      pageFactory = createPageFactory(context)
      init.resolve()
    },
    configureServer: server => () =>
      server.middlewares.use(async (req, res, next) => {
        const url = req.originalUrl!
        if (url.endsWith(stateSuffix)) {
          const pageUrl = url.slice(0, -stateSuffix.length) || '/'
          try {
            const pageState = await getState(pageUrl)
            if (pageState) {
              const payload = JSON.stringify(pageState)
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Content-Length', Buffer.byteLength(payload))
              res.writeHead(200)
              res.write(payload)
              res.end()
            } else {
              next()
            }
          } catch (error) {
            onError(error)
            res.writeHead(500)
            res.end()
          }
        } else {
          debug(`Received request: "${url}"`)
          handleRequest(async () => {
            debug(`Processing request: "${url}"`)
            await pageFactory.resolvePage(url, async (error, page) => {
              if (page) {
                const html = await server.transformIndexHtml(url, page.html)
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
            debug(`Completed request: "${url}"`)
          })
        }
      }),
  }
}
