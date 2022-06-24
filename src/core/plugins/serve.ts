import { ServerResponse } from 'http'
import os from 'os'
import { renderErrorFallback } from '../app/errorFallback'
import { createNegotiator } from '../app/negotiator'
import { RenderedFile } from '../app/types'
import { DevContext } from '../context'
import { Endpoint, Plugin } from '../core'
import { makeRequestUrl } from '../makeRequest'
import { parseUrl } from '../node/url'
import { writeResponse } from '../node/writeResponse'
import { streamToBuffer } from '../utils/streamToBuffer'

export const servePlugin = (onError: (e: any) => void) => (): Plugin => {
  // The server starts before Saus is ready, so we stall
  // any early page requests until it is.
  let init: PromiseLike<void>
  let didInit: () => void
  init = new Promise(resolve => (didInit = resolve))

  let context: DevContext
  let fileCache: Record<string, RenderedFile> = {}

  return {
    name: 'saus:serve',
    saus(c) {
      context = c as DevContext
      return {
        receiveDevApp() {
          // Once the app is ready, requests are only delayed
          // by hot reloading of SSR modules.
          const then: any = waitForReload.bind(null, context)
          init = { then }
          didInit()
        },
      }
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
            { 'content-type': responseType },
            renderError(error, responseType, context.root)
          )
        })
      }),
  }
}

async function processRequest(
  context: DevContext,
  req: Endpoint.RequestUrl,
  res: ServerResponse,
  next: () => void
): Promise<void> {
  const {
    app,
    hotReload: { nonce },
  } = context

  const { status, headers, body } = await app.callEndpoints(req)

  // Reprocess the request if modules were changed during.
  if (nonce !== context.hotReload.nonce) {
    return waitForReload(context, () => {
      return processRequest(context, req, res, next)
    })
  }

  if (status == null) {
    process.nextTick(next)
  } else {
    writeResponse(res, status, headers, body)
  }
}

function waitForReload<TResult1, TResult2>(
  context: DevContext,
  resolve?: () => TResult1,
  reject?: (e: any) => TResult2
) {
  return context.hotReload.promise.then(resolve, reject)
}

function renderError(
  error: any,
  responseType: string,
  root: string
): Endpoint.Body | undefined {
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
