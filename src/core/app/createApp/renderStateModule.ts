import { stateModuleArguments } from '@/runtime/loadStateModule'
import { prependBase } from '@/utils/base'
import { dataToEsm } from '@/utils/dataToEsm'
import { App } from '../types'

export const getStateModuleFactory = (
  app: App,
  ctx: App.Context
): App['renderStateModule'] =>
  function renderStateModule(cacheKey, [state, ...config], inline) {
    let lines: string[]
    if (inline) {
      const cacheEntry = dataToEsm([state, ...config], '')
      lines = [`"${cacheKey}": ${cacheEntry},`]
    } else {
      const cacheEntry = 'state' + commaDelimited(config)
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

function commaDelimited(arr: any[]) {
  return arr.map(value => ', ' + dataToEsm(value, '')).join('')
}
