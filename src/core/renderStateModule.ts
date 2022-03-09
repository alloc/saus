import { stateModuleArguments } from '../runtime/loadStateModule'
import { dataToEsm } from '../utils/dataToEsm'
import type { CacheEntry } from './withCache'

export function renderStateModule(
  stateModuleId: string,
  [state, ...config]: CacheEntry,
  stateCacheUrl: string
) {
  const cacheEntry =
    `[state` + config.map(value => ', ' + dataToEsm(value, '')).join('') + `]`

  const lines = [
    `import { globalCache } from "${stateCacheUrl}"`,
    dataToEsm(state, 'state'),
    `globalCache.loaded["${stateModuleId}"] = ${cacheEntry}`,
    `export default state`,
  ]

  const args = stateModuleArguments.get(stateModuleId)
  if (args) {
    lines.unshift(`/* ${JSON.stringify(args)} */`)
  }

  return lines.join('\n')
}
