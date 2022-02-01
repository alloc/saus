// HTTP helpers suitable for Node environments.
import http from 'http'
import https from 'https'
import md5Hex from 'md5-hex'
import { getCachedState } from '../runtime/getCachedState'
import { TimeToLive } from '../runtime/ttl'
import { Response } from './response'

type URL = import('url').URL
declare const URL: typeof import('url').URL

export type GetOptions = {
  headers?: Record<string, string>
  timeout?: number
}

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
  return getCachedState(cacheKey, () => {
    return new Promise(resolvedGet.bind(null, url, opts || {}, cacheKey, 0))
  })
}

function resolvedGet(
  url: string | URL,
  opts: GetOptions,
  cacheKey: string,
  redirectCount: number,
  resolve: (response: Response) => void,
  reject: (e: any) => void
) {
  if (typeof url == 'string') {
    url = new URL(url)
  }

  const request = urlToHttpOptions(url)
  request.headers = opts.headers
  request.timeout = opts.timeout

  const trace = Error()

  return (url.protocol == 'http' ? http : https)
    .request(request, resp => {
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
          return resolvedGet(
            resp.headers.location,
            opts,
            cacheKey,
            redirectCount + 1,
            resolve,
            reject
          )
        }
        const status = resp.statusCode!
        if (status >= 200 && status < 400) {
          if (status == 200 && cacheKey) {
            readCacheControl(resp.headers['cache-control'], cacheKey)
          }
          return resolve(
            new Response(Buffer.concat(chunks), status, resp.headers)
          )
        }
        trace.message = `Request to ${url} ended with status code ${resp.statusCode}.`
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

function getCacheKey(url: string, headers?: Record<string, string>) {
  let cacheKey = 'GET ' + url
  if (headers) {
    const keys = Object.keys(headers)
    if (keys.length > 1) {
      headers = keys.sort().reduce((sorted: any, key: string) => {
        sorted[key] = headers![key]
        return sorted
      }, {})
    }
    const hash = md5Hex(JSON.stringify(headers))
    cacheKey += ' ' + hash.slice(0, 8)
  }
  return cacheKey
}

const noCacheDirective = 'no-cache'
const maxAgeDirective = 'max-age'

function readCacheControl(cacheControl: string | undefined, cacheKey: string) {
  if (!cacheControl) return

  const directives = cacheControl.split(/, */)
  if (directives.includes(noCacheDirective)) {
    TimeToLive.set(cacheKey, 0)
  } else {
    const maxAge = directives.find(d => d.startsWith(maxAgeDirective))
    if (maxAge) {
      // TODO: support must-revalidate?
      const maxAgeSecs = Number(maxAge.slice(maxAgeDirective.length + 1))
      TimeToLive.set(cacheKey, maxAgeSecs)
    }
  }
}

interface HttpOptions extends http.RequestOptions {
  hash?: string
  search?: string
  pathname?: string
  href?: string
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
