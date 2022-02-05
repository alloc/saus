import { getCachedState } from '../runtime/getCachedState'
import { getPageFilename } from '../utils/getPageFilename'
import { unwrapDefault } from '../utils/unwrapDefault'

export const loadPageState = (pagePath: string) =>
  getCachedState(pagePath, async () => {
    const stateUrl =
      '/' + getPageFilename(pagePath, import.meta.env.BASE_URL) + '.js'

    return unwrapDefault(await import(/* @vite-ignore */ stateUrl))
  })
