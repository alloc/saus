import { getCachedState } from '../runtime/getCachedState'
import { getPageFilename } from '../utils/getPageFilename'
import { AnyToObject } from '../utils/types'
import { unwrapDefault } from '../utils/unwrapDefault'
import type { CommonClientProps } from './types'

export function loadPageState<Props extends object = any>(
  pagePath: string
): Promise<CommonClientProps & AnyToObject<Props, Record<string, any>>> {
  const trace = Error()
  return getCachedState(pagePath, async () => {
    const moduleUrl =
      '/' + getPageFilename(pagePath, import.meta.env.BASE_URL) + '.js'

    return unwrapDefault(
      await import(/* @vite-ignore */ moduleUrl).catch(error => {
        const reason = error.message
        if (/^Failed to fetch/.test(reason) && reason.includes(moduleUrl)) {
          throw Object.assign(trace, {
            message: `Page state not found: ${moduleUrl}`,
            code: 'PAGE_404',
          })
        }
        throw error
      })
    )
  })
}
