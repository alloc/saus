import { dataToEsm } from '../utils/dataToEsm'

export function renderStateModule(
  stateModuleId: string,
  state: any,
  stateCacheUrl: string
) {
  return [
    `import { loadedStateCache } from "${stateCacheUrl}"`,
    dataToEsm(state, `const state`),
    `loadedStateCache.set("${stateModuleId}", state)`,
    `export default state`,
  ].join('\n')
}
