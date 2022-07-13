import { clientPreloadsMarker } from '@/routeClients'
import { RETURN } from '@/tokens'
import { dataToEsm } from '@/utils/dataToEsm'

export function injectClientPreloads(
  code: string,
  preloads: string[],
  helpersModuleId: string
) {
  const preloadImport = `import {preloadModules} from "${helpersModuleId}"`
  const preloadCall = `preloadModules(${dataToEsm(preloads, '')})`
  return code.replace(
    clientPreloadsMarker,
    `${preloadImport};${RETURN}${preloadCall}`
  )
}
