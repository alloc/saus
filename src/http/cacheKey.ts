import { md5Hex } from '../utils/md5-hex'
import { Headers } from './response'

export function getCacheKey(url: string, headers?: Headers) {
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
