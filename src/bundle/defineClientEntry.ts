import * as clientExports from '../client/index.ssr'
import { __exportAll } from '../utils/esmInterop'
import { __d } from './ssrModules'

export function defineClientEntry(overrides?: Record<string, any>) {
  __d('saus/client', async __exports => {
    __exportAll(__exports, clientExports)
    overrides && __exportAll(__exports, overrides)
  })
}
