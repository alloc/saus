import { murmurHash } from '@utils/murmur3'
import type { Http } from './types'

/**
 * Generate a cache key for a GET request.
 */
export function getCacheKey(url: string, headers?: Http.Headers) {
  let cacheKey = 'GET ' + url
  if (headers) {
    const keys = Object.keys(headers)
    if (keys.length > 1) {
      headers = keys.sort().reduce((sorted: any, key: string) => {
        sorted[key] = headers![key]
        return sorted
      }, {})
    }
    const hash = murmurHash(JSON.stringify(headers))
    cacheKey += ' ' + hash
  }
  return cacheKey
}
