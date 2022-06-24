import { __exportAll } from '@/node/esmInterop'
import { __d } from '@/runtime/ssrModules'
import * as clientExports from '../client/api'

export function defineClientEntry(overrides?: Record<string, any>) {
  __d('saus/client', async __exports => {
    __exportAll(__exports, clientExports)
    overrides && __exportAll(__exports, overrides)
  })
}
