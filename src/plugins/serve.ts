import { clientCachePath } from '../bundle/constants'
import {
  applyHtmlProcessors,
  extractClientFunctions,
  Plugin,
  renderStateModule,
  RuntimeConfig,
  SausContext,
} from '../core'
import { loadState } from '../core/loadStateModule'
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
        const url = id.replace(/(\/index)?\.html\.js$/, '') || '/'
        const page = await pageFactory.render(url, {
          preferCache: true,
        })
        if (page) {
          return renderPageState(
            page,
            context.basePath,
            '@id/saus/src/client/helpers.ts'
          )
        }
      } else if (isStateModuleRequest(id)) {
        await init
        const stateModuleId = id.slice(7, -3)
        const state = await loadState(stateModuleId)
        if (state) {
          return renderStateModule(
            stateModuleId,
            state,
            '/@fs/' + clientCachePath
          )
        }
      }
    },
  }

  let runtimeConfig: RuntimeConfig

  const servePages: Plugin = {
    name: 'saus:servePages',
    saus: {
      onContext(c) {
        context = c
        runtimeConfig = {
          assetsDir: context.config.build.assetsDir,
          base: context.basePath,
          command: 'dev',
          defaultPath: context.defaultPath,
          minify: false,
          mode: context.config.mode,
          publicDir: context.config.publicDir,
          stateCacheUrl: '/@fs/' + clientCachePath,
        }
        pageFactory = createPageFactory(
          context,
          extractClientFunctions(context.renderPath),
          runtimeConfig
        )
        init = {
          // Defer to the reload promise after the context is initialized.
          then: (...args) => (c.reloading || Promise.resolve()).then(...args),
        }
        didInit()
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
              let html = await server.transformIndexHtml(url, page.html)
              if (context.htmlProcessors?.post.length) {
                html = await applyHtmlProcessors(
                  html,
                  { page, config: runtimeConfig },
                  context.htmlProcessors.post
                )
              }
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
