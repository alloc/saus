// HTTP helpers suitable for Node environments.
import { getCachedState } from '../runtime/getCachedState'
import type { CacheControl } from '../runtime/withCache'
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
export function get(url: string | URL, opts?: GetOptions) {
  const cacheKey = getCacheKey(
    typeof url == 'string' ? url : url.href,
    opts?.headers
  )

  return getCachedState(cacheKey, cacheControl => {
    const cachedResponse = responseCache?.read(cacheKey)
    if (cachedResponse && !cachedResponse.expired) {
      debug('Using cached GET request: %O', url)
      return Promise.resolve(cachedResponse.object)
    }

    const cacheResponse = (resp: Response) => {
      if (resp.status == 200) {
        useCacheControl(cacheControl, resp.headers['cache-control'] as string)
        if (responseCache && isFinite(cacheControl.maxAge)) {
          responseCache.write(cacheControl.key, resp, cacheControl.maxAge)
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
