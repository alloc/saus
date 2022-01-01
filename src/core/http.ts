import http from 'http'
import https from 'https'

type GetOptions = { headers?: Record<string, string> }

/**
 * Do one thing, do it well.
 *
 * Send a GET request, receive a `Promise<Buffer>` object.
 */
export function get(url: string | URL, opts?: GetOptions) {
  return new Promise(resolvedGet.bind(null, url, opts || {}, 0))
}

function resolvedGet(
  url: string | URL,
  opts: GetOptions,
  redirectCount: number,
  resolve: (data: Buffer) => void,
  reject: (e: any) => void
) {
  if (typeof url == 'string') {
    url = new URL(url)
  }

  const request = urlToHttpOptions(url)
  request.headers = opts.headers

  return (url.protocol == 'http' ? http : https)
    .request(request, resp => {
      const chunks: Buffer[] = []
      resp.on('data', chunk => {
        chunks.push(chunk)
      })
      resp.on('close', reject)
      resp.on('error', reject)
      resp.on('end', () => {
        if (isRedirect(resp) && redirectCount < 10) {
          return resolvedGet(
            resp.headers.location,
            opts,
            redirectCount + 1,
            resolve,
            reject
          )
        }
        if (resp.statusCode == 200) {
          return resolve(Buffer.concat(chunks))
        }
        reject(
          Error(`Request to ${url} ended with status code ${resp.statusCode}`)
        )
      })
    })
    .on('error', reject)
    .end()
}

function isRedirect(resp: {
  statusCode?: number
  headers: { location?: string }
}): resp is { headers: { location: string } } {
  const status = resp.statusCode!
  return (status == 301 || status == 302) && !!resp.headers.location
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
