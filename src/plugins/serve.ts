import { ServerResponse } from 'http'
import os from 'os'
import { renderErrorFallback } from '../app/errorFallback'
import { createNegotiator } from '../app/negotiator'
import { RenderedFile } from '../app/types'
import { Endpoint, Plugin, SausContext } from '../core'
import { makeRequestUrl } from '../core/makeRequest'
import { writeResponse } from '../runtime/writeResponse'
import { streamToBuffer } from '../utils/streamToBuffer'
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
          () => streamToBuffer(req)
        )

        url.object = req

        await processRequest(context, url, res, next).catch(error => {
          onError(error)

          const negotiate = createNegotiator(req.headers.accept)
          const [responseType] = negotiate
            ? negotiate(['text/html', 'application/json'])
            : []

          if (!responseType) {
            return writeResponse(res, 500)
          }

          writeResponse(
            res,
            200,
            { 'Content-Type': responseType },
            renderError(error, responseType, context.root)
          )
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
    writeResponse(res, status, headers, body)
  }
}

function renderError(
  error: any,
  responseType: string,
  root: string
): Endpoint.ResponseBody | undefined {
  if (responseType == 'text/html')
    return {
      text: renderErrorFallback(error, {
        homeDir: os.homedir(),
        root,
        ssr: true,
      }),
    }

  if (responseType == 'application/json') {
    return { json: { error: error.message } }
  }
}
