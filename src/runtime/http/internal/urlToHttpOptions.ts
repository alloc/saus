import { URL } from '../types'

// https://github.com/nodejs/node/blob/0de6a6341a566f990d0058b28a0a3cb5b052c6b3/lib/internal/url.js#L1388
export function urlToHttpOptions(url: URL) {
  const options: Http.Options = {
    protocol: url.protocol,
    hostname: url.hostname.startsWith('[')
      ? url.hostname.slice(1, -1)
      : url.hostname,
    hash: url.hash,
    search: url.search,
    pathname: url.pathname,
    path: `${url.pathname}${url.search}`,
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
