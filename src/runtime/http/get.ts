// HTTP helpers suitable for Node environments.
import { Cache, globalCache } from '../cache'
import { getCacheKey } from './cacheKey'
import { debug } from './debug'
import { http, HttpRequestOptions } from './http'
import { Response } from './response'
import { responseCache } from './responseCache'
import { URL } from './types'

export interface GetOptions extends Omit<HttpRequestOptions, 'body'> {}

/**
 * Do one thing, do it well.
 *
 * Send a GET request, receive a `Promise<Buffer>` object.
 */
export function get(url: string | URL, opts?: GetOptions): Promise<Response> {
  const cacheKey = getCacheKey(
    typeof url == 'string' ? url : url.href,
    opts?.headers
  )

  return globalCache.load(cacheKey, entry => {
    const cachedResponse = responseCache?.read(cacheKey)
    if (cachedResponse && !cachedResponse.expired) {
      debug('Using cached GET request: %O', url)
      return Promise.resolve(cachedResponse.object)
    }

    const cacheResponse = (resp: Response) => {
      if (resp.status == 200) {
        parseCacheControl(entry, resp.headers['cache-control'] as string)
        if (responseCache && isFinite(entry.maxAge)) {
          responseCache.write(entry.key, resp, entry.maxAge)
        }
      }
      return resp
    }

    debug('Sending GET request: %O', url)
    return http('get', url, opts).then(cacheResponse, error => {
      if (cachedResponse && error.code == 'ENOTFOUND') {
        return cachedResponse.object
      }
      throw error
    })
  })
}

const noCacheDirective = 'no-cache'
const maxAgeDirective = 'max-age'

function parseCacheControl(entry: Cache.EntryContext, header?: string) {
  if (!header) return

  const directives = header.split(/, */)
  if (directives.includes(noCacheDirective)) {
    entry.maxAge = 0
  } else {
    const maxAge = directives.find(d => d.startsWith(maxAgeDirective))
    if (maxAge) {
      // TODO: support must-revalidate?
      entry.maxAge = Number(maxAge.slice(maxAgeDirective.length + 1))
    }
  }
}
