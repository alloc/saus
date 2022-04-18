import { ServerResponse } from 'http'
import getBody from 'raw-body'
import { RenderedFile } from '../app/types'
import {
  Plugin,
  renderStateModule,
  SausContext,
  unwrapBuffer,
  vite,
} from '../core'
import { Endpoint, makeRequestUrl } from '../core/endpoint'
import { globalCachePath } from '../core/paths'
import { renderPageState } from '../core/renderPageState'
import { globalCache } from '../runtime/cache'
import { stateModuleBase } from '../runtime/constants'
import { getCachedState } from '../runtime/getCachedState'
import { stateModulesById } from '../runtime/stateModules'
import { parseUrl } from '../utils/url'
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

        const url = parseUrl(id.replace(/(\/index)?\.html\.js$/, '') || '/')
        const [, route, params] = server.resolveRoute(
          makeRequestUrl(url, 'GET', { accept: 'text/html' })
        )
        if (!route) {
          return
        }
        url.routeParams = params

        const [page, error] = await server.renderPage(url, route)
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

        let path = req.originalUrl!
        if (!path.startsWith(context.basePath)) {
          return next()
        }

        // Remove URL fragment, but keep querystring
        path = path.replace(/#[^?]*/, '')
        // Remove base path
        path = path.slice(context.basePath.length - 1) || '/'

        if (path in fileCache) {
          const { data, mime } = fileCache[path]
          res.setHeader('Content-Type', mime)
          res.write(typeof data == 'string' ? data : Buffer.from(data.buffer))
          return res.end()
        }

        const url = makeRequestUrl(parseUrl(path), req.method!, req.headers)
        await processRequest(context, url, res, next).catch(error => {
          onError(error)
          res.writeHead(500)
          res.end()
        })
      }),
  }

  return [serveState, servePages]
}

async function processRequest(
  context: SausContext,
  req: Endpoint.RequestUrl,
  res: ServerResponse,
  next: () => void
): Promise<void> {
  const { server, reloadId } = context
  const [status, headers, body] = await server!.callEndpoints(req)
  if (reloadId !== context.reloadId) {
    return (context.reloading || Promise.resolve()).then(() => {
      return processRequest(context, req, res, next)
    })
  }
  if (status == null) {
    return next()
  }
  res.writeHead(status, undefined, headers || undefined)
  if (!body) {
    return res.end()
  }
  if ('stream' in body) {
    body.stream.pipe(res, { end: true })
  } else {
    const rawBody =
      'buffer' in body
        ? unwrapBuffer(body.buffer)
        : 'text' in body
        ? body.text
        : 'json' in body
        ? JSON.stringify(body)
        : null

    if (rawBody !== null) {
      res.write(rawBody)
    }
    res.end()
  }
}
