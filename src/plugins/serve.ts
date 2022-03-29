import getBody from 'raw-body'
import { Plugin, renderStateModule, SausContext, vite } from '../core'
import { globalCachePath } from '../core/paths'
import { renderPageState } from '../core/renderPageState'
import { ServedPage } from '../pages/servePage'
import { RenderedFile } from '../pages/types'
import { globalCache } from '../runtime/cache'
import { stateModuleBase } from '../runtime/constants'
import { getCachedState } from '../runtime/getCachedState'
import { stateModulesById } from '../runtime/stateModules'
import { formatAsyncStack } from '../vm/formatAsyncStack'

export const servePlugin = (onError: (e: any) => void) => (): Plugin[] => {
  // The server starts before Saus is ready, so we stall
  // any early page requests until it is.
  let init: PromiseLike<void>
  let didInit: () => void
  init = new Promise(resolve => (didInit = resolve))

  let context: SausContext
  let server: vite.ViteDevServer

  function isPageStateRequest(url: string) {
    return url.endsWith('.html.js')
  }
  function isStateModuleRequest(url: string) {
    return url.startsWith(stateModuleBase) && url.endsWith('.js')
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
        const [page, error] = await server.renderPage(url)
        if (error) {
          const props = { message: error.message, stack: error.stack }
          return `throw Object.assign(Error(), ${JSON.stringify(props)})`
        }
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
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST') {
          return next()
        }

        const url = req.url!.slice(context.basePath.length - 1) || '/'
        if (!isStateModuleRequest(url)) {
          return next()
        }

        try {
          const [id, args] = JSON.parse(
            (await getBody(req)).toString('utf8')
          ) as [string, any[]]

          const stateModule = stateModulesById.get(id)
          if (!stateModule) {
            return next()
          }

          await stateModule.load(...args)
          res.writeHead(200)
          res.end()
        } catch (error: any) {
          formatAsyncStack(
            error,
            server.moduleMap,
            [],
            context.config.filterStack
          )
          console.error(error)
          res.writeHead(500)
          res.end()
        }
      })
    },
  }

  let fileCache: Record<string, RenderedFile> = {}

  const servePages: Plugin = {
    name: 'saus:servePages',
    saus(c) {
      context = c
      server = c.server!
      init = {
        // Defer to the reload promise after the context is initialized.
        then: (...args) => (c.reloading || Promise.resolve()).then(...args),
      }
      didInit()
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
        await server.servePage(url).then(respond)

        function respond({ error, body, headers }: ServedPage = {}): any {
          if (reloadId !== (reloadId = context.reloadId)) {
            return (context.reloading || Promise.resolve()).then(() => {
              return server.servePage(url).then(respond)
            })
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
