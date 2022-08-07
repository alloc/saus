import { stateModuleArguments } from '@/runtime/loadStateModule'
import { prependBase } from '@/utils/base'
import { dataToEsm } from '@/utils/dataToEsm'
import { App } from '../types'

export const getStateModuleFactory = (
  app: App,
  ctx: App.Context
): App['renderStateModule'] =>
  function renderStateModule(cacheKey, state, expiresAt, inline) {
    let lines: string[]
    if (inline) {
      const cacheEntry = dataToEsm(
        expiresAt == null ? [state] : [state, expiresAt],
        ''
      )
      lines = [`"${cacheKey}": ${cacheEntry},`]
    } else {
      const cacheEntry = 'state' + (expiresAt == null ? '' : `, ${expiresAt}`)
      const stateCacheUrl = prependBase(
        ctx.config.clientCacheId,
        ctx.config.base
      )
      lines = [
        `import { globalCache } from "${stateCacheUrl}"`,
        dataToEsm(state, 'state'),
        `globalCache.loaded["${cacheKey}"] = [${cacheEntry}]`,
        `export default state`,
      ]
    }
    const args = stateModuleArguments.get(cacheKey)
    const argsComment = args ? `/* ${JSON.stringify(args)} */\n` : ``
    return argsComment + lines.join('\n')
  }
