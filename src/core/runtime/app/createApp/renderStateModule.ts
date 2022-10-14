import { prependBase } from '@utils/base'
import { dataToEsm } from '../../dataToEsm'
import { App } from '../types'

export const getStateModuleFactory = (
  ctx: App.Context
): App['renderStateModule'] =>
  function renderStateModule(name, { state, args, timestamp, maxAge }, inline) {
    const stateCacheUrl = prependBase(ctx.config.clientCacheId, ctx.config.base)
    const argsExpr = dataToEsm(args, '')
    const stateExpr = dataToEsm(state, '')
    const setStateStmt = `setState("${name}", ${argsExpr}, ${stateExpr}, ${timestamp}${
      maxAge == null ? `` : `, ${maxAge}`
    })`
    if (inline) {
      return setStateStmt
    }
    const lines = [
      `import { setState } from "${stateCacheUrl}"`,
      `export default ${setStateStmt}`,
    ]
    return lines.join('\n')
  }
