import {
  applyHtmlProcessors,
  extractClientFunctions,
  Plugin,
  renderStateModule,
  RuntimeConfig,
  SausContext,
} from '../core'
import { globalCachePath } from '../core/paths'
import { renderPageState } from '../core/renderPageState'
import { createPageFactory, PageFactory } from '../pages'
import { RenderedFile, RenderPageOptions } from '../pages/types'
import { globalCache } from '../runtime/cache'
import { getCachedState } from '../runtime/getCachedState'
import { resolveEntryUrl } from '../utils/resolveEntryUrl'
import { purgeModule } from '../vm/moduleMap'

export type ServedPage = {
  error?: any
  body?: any
  headers?: [string, string | number][]
}

export const servePlugin = (onError: (e: any) => void) => (): Plugin[] => {
  // The server starts before Saus is ready, so we stall
  // any early page requests until it is.
  let init: PromiseLike<void>
  let didInit: () => void
  init = new Promise(resolve => (didInit = resolve))

  let pageFactory: PageFactory
  let servePage: (url: string) => Promise<ServedPage | undefined>
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
        const page = await pageFactory.render(url)
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
        await getCachedState(stateModuleId, globalCache.loaders[stateModuleId])

        const stateEntry = globalCache.loaded[stateModuleId]
        if (stateEntry) {
          return renderStateModule(
            stateModuleId,
            stateEntry,
            '/@fs/' + globalCachePath
          )
        }
      }
    },
  }

  let runtimeConfig: RuntimeConfig
  let fileCache: Record<string, RenderedFile> = {}

  const servePages: Plugin = {
    name: 'saus:servePages',
    saus: {
      onContext(c) {
        context = c
        const { config } = c
        runtimeConfig = {
          assetsDir: config.build.assetsDir,
          base: context.basePath,
          command: 'dev',
          defaultPath: context.defaultPath,
          htmlTimeout: config.saus.htmlTimeout,
          minify: false,
          mode: context.config.mode,
          publicDir: config.publicDir,
          ssrRoutesId: '/@fs/' + context.routesPath,
          stateCacheId: '/@fs/' + globalCachePath,
        }
        pageFactory = createPageFactory(
          context,
          extractClientFunctions(context.renderPath),
          runtimeConfig,
          undefined,
          onError
        )
        const renderOpts: RenderPageOptions = {
          setup(pageContext) {
            const routeModulePath = resolveEntryUrl(route.moduleId, config)
            const routeModule = context.moduleMap![routeModulePath]
            if (routeModule) {
              purgeModule(routeModule.)
            } else {

            }
            return route.load()
          },
        }
        servePage = context.servePage = async url => {
          try {
            let page = await pageFactory.render(url, renderOpts)
            if (!page && !/\.[^./]+$/.test(url)) {
              page = await pageFactory.render(context.defaultPath, renderOpts)
            }
            if (page) {
              for (const file of page.files) {
                fileCache[file.id] = file
              }
              let html = await context.server!.transformIndexHtml(
                url,
                page.html
              )
              if (context.htmlProcessors?.post.length) {
                html = await applyHtmlProcessors(
                  html,
                  context.htmlProcessors.post,
                  { page, config: runtimeConfig },
                  runtimeConfig.htmlTimeout
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

        if (url in fileCache) {
          const { data, mime } = fileCache[url]
          return respond({
            body: typeof data == 'string' ? data : Buffer.from(data.buffer),
            headers: [['Content-Type', mime]],
          })
        }

        let { reloadId } = context
        try {
          await servePage(url).then(respond)
        } catch (error) {
          respond({ error })
        }

        function respond({ error, body, headers }: ServedPage = {}): any {
          if (reloadId !== (reloadId = context.reloadId)) {
            return (context.reloading || Promise.resolve())
              .then(() => servePage(url))
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
