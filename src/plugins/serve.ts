import { ServerResponse } from 'http'
import { gray, green, red } from 'kleur/colors'
import os from 'os'
import getBody from 'raw-body'
import { renderErrorFallback } from '../app/errorFallback'
import { createNegotiator } from '../app/negotiator'
import { RenderedFile } from '../app/types'
import { Endpoint, Plugin, SausContext } from '../core'
import { makeRequestUrl } from '../core/makeRequest'
import { writeResponse } from '../runtime/writeResponse'
import { parseUrl } from '../utils/url'

export const servePlugin = (onError: (e: any) => void) => (): Plugin => {
  // The server starts before Saus is ready, so we stall
  // any early page requests until it is.
  let init: PromiseLike<void>
  let didInit: () => void
  init = new Promise(resolve => (didInit = resolve))

  let context: SausContext
  let fileCache: Record<string, RenderedFile> = {}

  return {
    name: 'saus:serve',
    saus(c) {
      context = c
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

        const url = makeRequestUrl(
          parseUrl(path),
          req.method!,
          req.headers,
          () => getBody(req)
        )

        url.object = req

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
