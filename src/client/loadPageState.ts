import { getCachedState } from '../runtime/getCachedState'
import { getPageFilename } from '../utils/getPageFilename'
import { unwrapDefault } from '../utils/unwrapDefault'
import importMetaEnv from './constants/importMetaEnv'
import { loadModule } from './loadModule'

export const loadPageState = (pagePath: string) =>
  getCachedState(pagePath, async () => {
    const stateUrl =
      '/' + getPageFilename(pagePath, importMetaEnv.BASE_URL) + '.js'

    return unwrapDefault(await loadModule(stateUrl))
  })
