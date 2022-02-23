// HTTP helpers suitable for Node environments.
import http from 'http'
import https from 'https'
import type { CacheControl } from '../core/withCache'
import { getCachedState } from '../runtime/getCachedState'
import { getCacheKey } from './cacheKey'
import { debug } from './debug'
import { loadResponseCache } from './responseCache'
import { Response } from './response'
import { HttpOptions } from './types'
import { requestHook, responseHook } from './hooks'

type URL = import('url').URL
declare const URL: typeof import('url').URL

export type GetOptions = {
  headers?: Record<string, string>
  timeout?: number
}

const responseCache = loadResponseCache(process.cwd())

/**
 * Do one thing, do it well.
 *
 * Send a GET request, receive a `Promise<Buffer>` object.
 */
export function get(url: string | URL, opts?: GetOptions) {
  const cacheKey = getCacheKey(
    typeof url == 'string' ? url : url.href,
    opts?.headers
  )
  return getCachedState(cacheKey, cacheControl => {
    const cached = responseCache.read(cacheKey)
    if (cached) {
      debug('Using cached GET request: %O', url)
      return Promise.resolve(cached)
    }
    debug('Sending GET request: %O', url)
    return new Promise<Response>(
      (resolvedGet as Function).bind(
        null,
        url,
        opts || {},
        Error(),
        cacheControl,
        0
      )
    )
  })
}

function resolvedGet(
  url: string | URL,
  opts: GetOptions,
  trace: Error,
  cacheControl: CacheControl,
  redirectCount: number,
  resolve: (response: Response) => void,
  reject: (e: any) => void
) {
  if (typeof url == 'string') {
    url = new URL(url)
  }

  const req = urlToHttpOptions(url)
  req.headers = opts.headers
  req.timeout = opts.timeout

  Promise.resolve(requestHook.current(req)).then(resp => {
    const onResponse = (resp: Response) =>
      Promise.resolve(responseHook.current(req, resp)).then(() => {
        if (resp.status == 200) {
          useCacheControl(cacheControl, resp.headers['cache-control'] as string)
          if (isFinite(cacheControl.maxAge)) {
            responseCache.write(cacheControl.key, resp, cacheControl.maxAge)
          }
        }
        return resolve(resp)
      }, reject)

    return resp
      ? onResponse(resp)
      : sendRequest(req, trace, reject, onResponse, redirectCount, url =>
          /* onRedirect */
          resolvedGet(
            url,
            opts,
            trace,
            cacheControl,
            redirectCount + 1,
            resolve,
            reject
          )
        )
  }, reject)
}

function sendRequest(
  opts: HttpOptions,
  trace: Error,
  reject: (e: any) => void,
  resolve: (resp: Response) => void,
  redirectCount: number,
  onRedirect: (url: string) => void
) {
  const { request } = opts.protocol == 'http:' ? http : https
  request(opts, resp => {
    const chunks: Buffer[] = []
    resp.on('data', chunk => {
      chunks.push(chunk)
    })
    resp.on('error', e => {
      trace.message = e.message
      reject(trace)
    })
    resp.on('close', () => {
      if (isRedirect(resp) && redirectCount < 10) {
        return onRedirect(resp.headers.location)
      }
      const status = resp.statusCode!
      if (status >= 200 && status < 400) {
        return resolve(
          new Response(Buffer.concat(chunks), status, resp.headers)
        )
      }
      trace.message = `Request to ${opts.href} ended with status code ${resp.statusCode}.`
      reject(trace)
    })
  })
    .on('error', e => {
      trace.message = e.message
      reject(trace)
    })
    .end()
}

function isRedirect(resp: {
  statusCode?: number
  headers: { location?: string }
}): resp is { headers: { location: string } } {
  const status = resp.statusCode!
  return (status == 301 || status == 302) && !!resp.headers.location
}

const noCacheDirective = 'no-cache'
const maxAgeDirective = 'max-age'

function useCacheControl(cacheControl: CacheControl, header?: string) {
  if (!header) return

  const directives = header.split(/, */)
  if (directives.includes(noCacheDirective)) {
    cacheControl.maxAge = 0
  } else {
    const maxAge = directives.find(d => d.startsWith(maxAgeDirective))
    if (maxAge) {
      // TODO: support must-revalidate?
      cacheControl.maxAge = Number(maxAge.slice(maxAgeDirective.length + 1))
    }
  }
}

// https://github.com/nodejs/node/blob/0de6a6341a566f990d0058b28a0a3cb5b052c6b3/lib/internal/url.js#L1388
function urlToHttpOptions(url: URL) {
  const options: HttpOptions = {
    protocol: url.protocol,
    hostname: url.hostname.startsWith('[')
      ? url.hostname.slice(1, -1)
      : url.hostname,
    hash: url.hash,
    search: url.search,
    pathname: url.pathname,
    path: `${url.pathname || ''}${url.search || ''}`,
    href: url.href,
  }
  if (url.port !== '') {
    options.port = Number(url.port)
  }
  if (url.username || url.password) {
    options.auth = `${decodeURIComponent(url.username)}:${decodeURIComponent(
      url.password
    )}`
  }
  return options
}
