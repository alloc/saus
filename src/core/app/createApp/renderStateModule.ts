import { prependBase } from '@/utils/base'
import { dataToEsm } from '@/utils/dataToEsm'
import { App } from '../types'

export const getStateModuleFactory = (
  ctx: App.Context
): App['renderStateModule'] =>
  function renderStateModule(moduleId, args, state, expiresAt, inline) {
    const stateCacheUrl = prependBase(ctx.config.clientCacheId, ctx.config.base)
    const argsExpr = dataToEsm(args, '')
    const stateExpr = dataToEsm(state, '')
    const setStateStmt = `setState("${moduleId}", ${argsExpr}, ${stateExpr}${
      expiresAt == null ? `` : `, ${expiresAt}`
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
