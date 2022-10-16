import * as clientExports from '@client/api'
import { __d } from '@runtime/ssrModules'

/**
 * Set the exports of `saus/client` used by isolated SSR modules.
 */
export function injectSausClient(overrides?: Record<string, any>) {
  __d('saus/client', async __exports => {
    Object.assign(__exports, clientExports)
    overrides && Object.assign(__exports, overrides)
  })
}
