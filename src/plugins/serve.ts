import { ServerResponse } from 'http'
import { gray, green, red } from 'kleur/colors'
import os from 'os'
import getBody from 'raw-body'
import { renderErrorFallback } from '../app/errorFallback'
import { createNegotiator } from '../app/negotiator'
import { RenderedFile } from '../app/types'
import { Plugin, renderStateModule, SausContext, vite } from '../core'
import { Endpoint, makeRequestUrl } from '../core/endpoint'
import { globalCachePath } from '../core/paths'
import { renderPageState } from '../core/renderPageState'
import { writeResponse } from '../core/server/writeResponse'
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
        const [, route] = server.resolveRoute(
          makeRequestUrl(url, 'GET', { accept: 'text/html' })
        )
        if (!route) {
          return
        }

        const [page, error] = await server.renderPage(url, route)
        if (error) {
          const props = { message: error.message, stack: error.stack }
          return `throw Object.assign(Error(), ${JSON.stringify(props)})`
        }
        if (page?.props) {
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
          return process.nextTick(next)
        }

        const url = req.url!.slice(context.basePath.length - 1) || '/'
        if (!isStateModuleRequest(url)) {
          return process.nextTick(next)
        }

        try {
          const [id, args] = JSON.parse(
            (await getBody(req)).toString('utf8')
          ) as [string, any[]]

          const stateModule = stateModulesById.get(id)
          if (!stateModule) {
            return process.nextTick(next)
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
          return process.nextTick(next)
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

          const negotiate = createNegotiator(req.headers.accept)
          if (!negotiate) {
            return writeResponse(res, 500)
          }

          const [responseType] = negotiate(['text/html', 'application/json'])
          const headers = { 'Content-Type': responseType }
          writeResponse(res, 200, headers, {
            text:
              responseType == 'text/html'
                ? renderErrorFallback(error, {
                    homeDir: os.homedir(),
                    root: context.root,
                    ssr: true,
                  })
                : { error: error.message },
          })
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
    process.nextTick(next)
  } else {
    const statusColor = /^[23]/.test('' + status) ? green : red
    const contentLength = headers && (headers['content-length'] as string)
    context.logger.info(
      statusColor('⨠ ' + status) +
        ` ${req} ${
          contentLength ? gray((+contentLength / 1024).toFixed(2) + 'KiB') : ''
        }`
    )
    writeResponse(res, status, headers, body)
  }
}
