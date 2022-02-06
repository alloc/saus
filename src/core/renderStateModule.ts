import { dataToEsm } from '../utils/dataToEsm'
import type { CacheEntry } from './withCache'

export function renderStateModule(
  stateModuleId: string,
  [state, ...config]: CacheEntry,
  stateCacheUrl: string
) {
  const cacheEntry =
    `[state` + config.map(value => ', ' + dataToEsm(value, '')).join('') + `]`

  return [
    `import { globalCache } from "${stateCacheUrl}"`,
    dataToEsm(state, 'state'),
    `globalCache.loaded["${stateModuleId}"] = ${cacheEntry}`,
    `export default state`,
  ].join('\n')
}
