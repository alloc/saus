import * as clientNodeAPI from '@client/node/api'
import clientRoutes from '@client/routes'
import { __d } from '@runtime/ssrModules'

/**
 * Set the exports of `saus/client` used by isolated SSR modules.
 */
export function injectSausClient(overrides?: Record<string, any>) {
  __d('saus/client', async __exports => {
    __exports.routes = clientRoutes
    Object.assign(__exports, clientNodeAPI)
    overrides && Object.assign(__exports, overrides)
  })
}
