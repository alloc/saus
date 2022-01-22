import type { RenderedPage } from '../pages/types'
import { dataToEsm } from '../utils/dataToEsm'
import { INDENT, RETURN, SPACE } from './tokens'

export function renderPageState(
  { path, state, stateModules, head }: RenderedPage,
  base: string,
  helpersId: string,
  preloadUrls?: string[]
) {
  const toStateUrl = (id: string) => base + 'state/' + id + '.js'
  const stateModuleUrls = new Set(stateModules.map(toStateUrl))

  const inlinedStateUrls: string[] = []
  const inlinedStateIdents: string[] = []

  let code = dataToEsm(state, null, (_, value) => {
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
    const idents = inlinedStateIdents.join(',' + SPACE)
    const imports = inlinedStateUrls
      .concat(Array.from(stateModuleUrls, toStateUrl))
      .map(url => INDENT + `import("${url}"),`)

    helpers.push('resolveModules')
    code =
      `const [${idents}] = await resolveModules(` +
      RETURN +
      imports.join(RETURN) +
      RETURN +
      `)\n` +
      code
  } else if (stateModuleUrls.size) {
    const imports = Array.from(
      stateModuleUrls,
      url => INDENT + `import("${url}"),`
    )
    code =
      `await Promise.all([${RETURN + imports.join(RETURN) + RETURN}])\n` + code
  }

  if (head) {
    helpers.push('describeHead')
    code = `describeHead("${path}",${SPACE}${dataToEsm(head, '')})\n` + code
  }

  if (preloadUrls?.length) {
    preloadUrls = preloadUrls.map(url => base + url)
    helpers.push('preloadModules')
    code = `preloadModules(${dataToEsm(preloadUrls, '')})\n` + code
  }

  if (helpers.length) {
    code =
      `import {${SPACE + helpers.join(',' + SPACE) + SPACE}} from "${
        base + helpersId
      }"\n` + code
  }

  return code
}
