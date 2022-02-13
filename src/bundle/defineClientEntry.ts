import { __exportAll } from '../utils/esmInterop'
import * as clientEntry from './clientEntry'
import { __d } from './ssrModules'

export function defineClientEntry(overrides?: Record<string, any>) {
  __d('saus/client', async __exports => {
    __exportAll(__exports, clientEntry)
    overrides && __exportAll(__exports, overrides)
  })
}
