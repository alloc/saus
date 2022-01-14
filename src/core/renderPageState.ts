import endent from 'endent'
import type { PageState } from '../pages'
import { dataToEsm } from '../utils/dataToEsm'

export function renderPageState(pageState: PageState) {
  const stateModuleIds = new Set(pageState.$)

  const inlinedStateIds: string[] = []
  const inlinedStateIdents: string[] = []

  const defaultExport = dataToEsm(pageState, null, (_, value) => {
    const inlinedStateId = value && value['@import']
    if (inlinedStateId) {
      let index = inlinedStateIds.indexOf(inlinedStateId)
      if (index < 0) {
        index = inlinedStateIds.push(inlinedStateId) - 1
        stateModuleIds.add(inlinedStateId)
      }
      const ident = 'stateModule' + (index + 1)
      inlinedStateIdents[index] = ident
      return ident
    }
  })

  if (!stateModuleIds.size) {
    return defaultExport
  }

  const toModuleUrl = (stateModuleId: string) =>
    '/state/' + stateModuleId + '.js'

  if (!inlinedStateIds.length) {
    const imports = Array.from(
      stateModuleIds,
      id => `import("${toModuleUrl(id)}"),`
    )
    return endent`
      await Promise.all([
        ${imports.join(',')}
      ])
      ${defaultExport}
    `
  }

  const inlinedStateUrls = inlinedStateIds.map(stateModuleId => {
    stateModuleIds.delete(stateModuleId)
    return toModuleUrl(stateModuleId)
  })

  const idents = inlinedStateIdents.join(',')
  const imports = inlinedStateUrls
    .concat(Array.from(stateModuleIds, toModuleUrl))
    .map((url, i) => {
      const suffix = i < inlinedStateUrls.length ? '.then(unwrapDefault)' : ''

      return `import("${url}")${suffix},`
    })

  return endent`
    import { resolveModules } from "saus/client"
    const [${idents}] = await resolveModules(
      ${imports.join('\n')}
    )
    ${defaultExport}
  `
}
