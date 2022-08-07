import { globalCache } from '@/runtime/cache'
import { getPageFilename } from '../utils/getPageFilename'
import { AnyToObject } from '../utils/types'
import { unwrapDefault } from '../utils/unwrapDefault'
import type { CommonClientProps } from './types'

export function loadPageState<Props extends object = any>(
  pagePath: string,
  timestamp = Date.now()
): Promise<CommonClientProps & AnyToObject<Props, Record<string, any>>> {
  const trace = Error()
  const moduleUrl =
    '/' + getPageFilename(pagePath, import.meta.env.BASE_URL) + '.js'

  return Promise.resolve(globalCache.access(pagePath))
    .then(cached => {
      if (cached) {
        const [state, expiresAt = Infinity] = cached
        if (expiresAt > timestamp) {
          return state as any
        }
      }
      return globalCache.load(pagePath, async () => {
        return unwrapDefault(
          await import(/* @vite-ignore */ moduleUrl + '?t=' + timestamp)
        )
      })
    })
    .catch(error => {
      const reason = error.message
      if (/^Failed to fetch/.test(reason) && reason.includes(moduleUrl)) {
        throw Object.assign(trace, {
          message: `Page state not found: ${moduleUrl}`,
          code: 'PAGE_404',
        })
      }
      throw error
    })
}
