import type { CommonClientProps } from '../client'
import { getCachedState } from '../runtime/getCachedState'
import { getPageFilename } from '../utils/getPageFilename'
import { unwrapDefault } from '../utils/unwrapDefault'

export function loadPageState(pagePath: string) {
  const trace = Error()
  return getCachedState(pagePath, async () => {
    const stateUrl =
      '/' + getPageFilename(pagePath, import.meta.env.BASE_URL) + '.js'

    return unwrapDefault<CommonClientProps<any>>(
      await import(/* @vite-ignore */ stateUrl).catch(error => {
        const reason = error.message
        if (/^Failed to fetch/.test(reason) && reason.includes(stateUrl)) {
          throw Object.assign(trace, {
            message: `Page state not found: ${stateUrl}`,
            code: 'PAGE_404',
          })
        }
        throw error
      })
    )
  })
}
