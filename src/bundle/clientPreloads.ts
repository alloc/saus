import { clientPreloadsMarker } from '@/routeClients'
import { dataToEsm } from '@runtime/dataToEsm'
import { RETURN } from '@runtime/tokens'

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
