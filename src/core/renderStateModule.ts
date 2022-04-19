import { stateModuleArguments } from '../runtime/loadStateModule'
import { dataToEsm } from '../utils/dataToEsm'
import type { CacheEntry } from './withCache'

export function renderStateModule(
  stateModuleId: string,
  [state, ...config]: CacheEntry,
  stateCacheUrl: string,
  inline?: boolean
) {
  let lines: string[]
  if (inline) {
    const cacheEntry = dataToEsm([state, ...config], '')
    lines = [`"${stateModuleId}": ${cacheEntry},`]
  } else {
    const cacheEntry = 'state' + commaDelimited(config)
    lines = [
      `import { globalCache } from "${stateCacheUrl}"`,
      dataToEsm(state, 'state'),
      `globalCache.loaded["${stateModuleId}"] = [${cacheEntry}]`,
      `export default state`,
    ]
  }
  const args = stateModuleArguments.get(stateModuleId)
  const argsComment = args ? `/* ${JSON.stringify(args)} */\n` : ``
  return argsComment + lines.join('\n')
}

function commaDelimited(arr: any[]) {
  return arr.map(value => ', ' + dataToEsm(value, '')).join('')
}
