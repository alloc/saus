import {
  extractClientFunctions,
  mergeHtmlProcessors,
  Plugin,
  renderStateModule,
  RuntimeConfig,
  SausContext,
  stateCacheUrl,
} from '../core'
import { renderPageState } from '../core/renderPageState'
import { createPageFactory, PageFactory } from '../pages'

export const servePlugin = (onError: (e: any) => void) => (): Plugin[] => {
  // The server starts before Saus is ready, so we stall
  // any early page requests until it is.
  let init: PromiseLike<void>
  let didInit: () => void
  init = new Promise(resolve => (didInit = resolve))

  let pageFactory: PageFactory
  let context: SausContext

  function isPageStateRequest(url: string) {
    return url.endsWith('.html.js')
  }
  function isStateModuleRequest(url: string) {
    return url.startsWith('/state/') && url.endsWith('.js')
  }

  const serveState: Plugin = {
    name: 'saus:serveState',
    resolveId(id) {
      return isPageStateRequest(id) || isStateModuleRequest(id) ? id : null
    },
    async load(id) {
      if (isPageStateRequest(id)) {
        await init
        const pageState = await pageFactory.getPageState(id.slice(0, -3))
        if (pageState) {
          if (pageState.error) {
            throw pageState.error
          }
          return renderPageState(
            pageState,
            context.basePath,
            '@id/saus/src/client/helpers.ts'
          )
        }
      } else if (isStateModuleRequest(id)) {
        await init
        const stateModuleId = id.slice(7, -3)
        const state = await pageFactory.resolveState(stateModuleId)
        if (state) {
          return renderStateModule(stateModuleId, state, stateCacheUrl)
        }
      }
    },
  }

  const servePages: Plugin = {
    name: 'saus:servePages',
    saus: {
      onContext(c) {
        context = c

        const config: RuntimeConfig = {
          assetsDir: context.config.build.assetsDir,
          base: context.basePath,
          command: 'dev',
          defaultPath: context.defaultPath,
          minify: false,
          mode: context.config.mode,
          publicDir: context.config.publicDir,
          stateCacheUrl,
        }

        context.runtimeHooks.forEach(onSetup => {
          onSetup(config)
        })

        if (context.htmlProcessors) {
          context.processHtml = mergeHtmlProcessors(
            context.htmlProcessors,
            page => ({ page, config })
          )
        }

        pageFactory = createPageFactory(
          context,
          extractClientFunctions(context.renderPath)
        )

        didInit()
        init = {
          // Defer to the reload promise after the context is initialized.
          then: (...args) => (c.reloading || Promise.resolve()).then(...args),
        }
      },
    },
    configureServer: server => () =>
      server.middlewares.use(async (req, res, next) => {
        await init

        let url = req.originalUrl!
        if (!url.startsWith(context.basePath)) {
          return next()
        }

        // Remove URL fragment, but keep querystring
        url = url.replace(/#[^?]*/, '')
        // Remove base path
        url = url.slice(context.basePath.length - 1) || '/'

        let { reloadId } = context
        try {
          await renderPage().then(respond)
        } catch (error) {
          respond({ error })
        }

        type Response = {
          error?: any
          body?: any
          headers?: [string, string | number][]
        }

        async function renderPage(): Promise<Response | undefined> {
          try {
            const page = await pageFactory.render(url)
            if (page) {
              const html = await server.transformIndexHtml(url, page.html)
              return {
                body: html,
                headers: [
                  ['Content-Type', 'text/html; charset=utf-8'],
                  ['Content-Length', Buffer.byteLength(html)],
                ],
              }
            }
          } catch (error) {
            return { error }
          }
        }

        function respond({ error, body, headers }: Response = {}): any {
          if (reloadId !== (reloadId = context.reloadId)) {
            return (context.reloading || Promise.resolve())
              .then(renderPage)
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

  return [serveState, servePages]
}
