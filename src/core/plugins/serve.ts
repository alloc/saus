import { stripHtmlSuffix } from '@utils/stripHtmlSuffix'
import { IncomingMessage, ServerResponse } from 'http'
import os from 'os'
import { renderErrorFallback } from '../app/errorFallback'
import { createNegotiator } from '../app/negotiator'
import { RenderedFile, ResolvedRoute } from '../app/types'
import { DevContext } from '../context'
import { Endpoint, Plugin } from '../core'
import { parseUrl } from '../node/url'
import { writeResponse } from '../node/writeResponse'
import { makeRequestUrl } from '../runtime/makeRequest'
import { streamToBuffer } from '../utils/streamToBuffer'
import { vite } from '../vite'

/**
 * The route functions are resolved before Vite middleware runs,
 * in case Saus routes want to override default Vite behavior.
 * Those route functions are cached here so the `processRequest`
 * function can easily access them.
 */
const requestMetas = new WeakMap<IncomingMessage, RequestMeta>()

type RequestMeta = {
  url: Endpoint.RequestUrl
  resolved: ResolvedRoute
}

export const servePlugin = (onError: (e: any) => void) => (): Plugin => {
  // The server starts before Saus is ready, so we stall
  // any early page requests until it is.
  let init: PromiseLike<void>
  let didInit: () => void
  init = new Promise(resolve => (didInit = resolve))

  let context: DevContext
  let fileCache: Record<string, RenderedFile> = {}

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  let serveApp: vite.Connect.NextHandleFunction = (req, res, next) =>
    requestMetas.has(req) &&
    processRequest(context, req, res, next).catch(error => {
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
    configureServer: server => {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      server.middlewares.use(async (req, res, next) => {
        let url = req.url!
        if (!url.startsWith(context.basePath)) {
          return process.nextTick(next)
        }
        url = (req.originalUrl = url).slice(context.basePath.length - 1)
        if (url.startsWith('/@id/') || url.startsWith('/@fs/')) {
          return process.nextTick(next)
        }
        await init
        if (url in fileCache) {
          const { data, mime } = fileCache[url]
          res.setHeader('Content-Type', mime)
          res.write(typeof data == 'string' ? data : Buffer.from(data.buffer))
          return res.end()
        }
        req.url = url
        const { functions, route } = resolveFunctions(req, context)
        if (functions.length && route !== context.defaultRoute) {
          serveApp(req, res, err => {
            req.url = req.originalUrl
            next(err)
          })
        } else {
          req.url = req.originalUrl
          process.nextTick(next)
        }
      })

      return () => {
        server.middlewares.use(serveApp)
      }
    },
  }
}

function resolveFunctions(_req: IncomingMessage, context: DevContext) {
  const url = parseUrl(stripHtmlSuffix(_req.url!))
  const req = makeRequestUrl(url, {
    object: _req,
    method: _req.method!,
    headers: _req.headers,
    read: encoding => streamToBuffer(_req, 0, encoding),
  })
  const resolved = context.app.resolveRoute(req)
  requestMetas.set(_req, {
    url: req,
    resolved,
  })
  return resolved
}

async function processRequest(
  context: DevContext,
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
): Promise<void> {
  const {
    app,
    hotReload: { nonce },
  } = context

  const { url, resolved } = requestMetas.get(req)!
  const { status, headers, body } = await app.callEndpoints(url, resolved)

  // Reprocess the request if modules were changed during.
  if (nonce !== context.hotReload.nonce) {
    return waitForReload(context, () => {
      const { functions } = resolveFunctions(req, context)
      return functions.length
        ? processRequest(context, req, res, next)
        : process.nextTick(next)
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
