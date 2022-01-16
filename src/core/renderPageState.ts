import endent from 'endent'
import type { PageState } from '../pages'
import { dataToEsm } from '../utils/dataToEsm'

export function renderPageState(
  pageState: PageState,
  base: string,
  helpersId: string,
  preloadUrls?: string[]
) {
  const toStateUrl = (id: string) => base + 'state/' + id + '.js'
  const stateModuleUrls = new Set(pageState.$.map(toStateUrl))

  const inlinedStateUrls: string[] = []
  const inlinedStateIdents: string[] = []

  let code = dataToEsm(pageState, null, (_, value) => {
    const inlinedStateId = value && value['@import']
    if (inlinedStateId) {
      let stateUrl = toStateUrl(inlinedStateId)
      let index = inlinedStateUrls.indexOf(stateUrl)
      if (index < 0) {
        index = inlinedStateUrls.push(stateUrl) - 1
        stateModuleUrls.delete(stateUrl)
      }
      const ident = 's' + (index + 1)
      inlinedStateIdents[index] = ident
      return ident
    }
  })

  const helpers: string[] = []

  if (inlinedStateUrls.length) {
    const idents = inlinedStateIdents.join(',')
    const imports = inlinedStateUrls
      .concat(Array.from(stateModuleUrls, toStateUrl))
      .map(url => `import("${url}"),`)

    helpers.push('resolveModules')
    code = endent`
      const [${idents}] = await resolveModules(
        ${imports.join('\n')}
      )
      ${code}
    `
  } else if (stateModuleUrls.size) {
    const imports = Array.from(stateModuleUrls, url => `import("${url}"),`)
    code = endent`
      await Promise.all([
        ${imports.join('\n')}
      ])
      ${code}
    `
  }

  if (preloadUrls?.length) {
    preloadUrls = preloadUrls.map(url => base + url)
    helpers.push('preloadModules')
    code = endent`
      preloadModules(${dataToEsm(preloadUrls, '')})
      ${code}
    `
  }

  if (helpers.length) {
    code = endent`
      import { ${helpers.join(', ')} } from "${base + helpersId}"
      ${code}
    `
  }

  return code
}
