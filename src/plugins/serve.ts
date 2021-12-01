import { Plugin, SausContext } from '../core'
import { createPageFactory, PageFactory } from '../pages'
import { defer } from '../utils/defer'

const stateSuffix = /\/state\.json$/

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
        const url = req.originalUrl!.replace(/#[^?]*/, '')

        let { reloadId } = context
        try {
          await Promise.all([init, context.reloading])
          await processRequest().then(respond)
        } catch (error) {
          respond({ error })
        }

        type Response = {
          error?: any
          body?: any
          headers?: [string, string | number][]
        }

        async function processRequest(): Promise<Response | undefined> {
          if (stateSuffix.test(url)) {
            let pageUrl = url.replace(stateSuffix, '')
            if (pageUrl[0] !== '/') {
              pageUrl = '/' + pageUrl
            }
            try {
              const pageState = await pageFactory.getState(pageUrl)
              if (pageState) {
                const body = JSON.stringify(pageState)
                return {
                  body,
                  headers: [
                    ['Content-Type', 'application/json'],
                    ['Content-Length', Buffer.byteLength(body)],
                  ],
                }
              }
            } catch (error) {
              return { error }
            }
          } else {
            let response: Response | undefined
            await pageFactory.resolvePage(url, async (error, page) => {
              if (page) {
                const html = await server.transformIndexHtml(url, page.html)
                response = {
                  body: html,
                  headers: [
                    ['Content-Type', 'text/html; charset=utf-8'],
                    ['Content-Length', Buffer.byteLength(html)],
                  ],
                }
              } else if (error) {
                response = { error }
              }
            })
            return response
          }
        }

        function respond({ error, body, headers }: Response = {}): any {
          if (reloadId !== (reloadId = context.reloadId)) {
            return (context.reloading || Promise.resolve())
              .then(processRequest)
              .then(respond)
          }
          if (error) {
            onError(error)
            res.writeHead(500)
            res.end()
          } else if (body) {
            headers?.forEach(([key, value]) => res.setHeader(key, value))
            res.writeHead(200)
            res.write(body)
            res.end()
          } else {
            next()
          }
        }
      }),
  }
}
