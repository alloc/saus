import { inlinedStateMap } from '../app/global'
import type { RenderedPage } from '../app/types'
import { globalCache } from '../runtime/cache'
import { stateModuleBase } from '../runtime/constants'
import { dataToEsm } from '../utils/dataToEsm'
import { ParsedHeadTag } from '../utils/parseHead'
import { prependBase } from '../utils/prependBase'
import { ClientState } from './client'
import { globalCachePath } from './paths'
import { renderStateModule } from './renderStateModule'
import { INDENT, RETURN, SPACE } from './tokens'

export interface ServerState extends ClientState {
  _client: ClientState
  _ts?: number
}

/**
 * Render a client module for the page state.
 */
export function renderPageState(
  { path, state, stateModules, head }: RenderedPage,
  base: string,
  helpersId: string,
  preloadUrls?: string[]
) {
  const toStateUrl = (id: string) =>
    prependBase(stateModuleBase + id + '.js', base)

  const stateModuleUrls = new Set(stateModules.map(toStateUrl))
  const nestedStateUrls: string[] = []
  const nestedStateIdents: string[] = []

  let code = dataToEsm((state as ServerState)._client, null, (_, value) => {
    const inlinedStateId = value && value['@import']
    if (inlinedStateId) {
      let stateUrl = toStateUrl(inlinedStateId)
      let index = nestedStateUrls.indexOf(stateUrl)
      if (index < 0) {
        index = nestedStateUrls.push(stateUrl) - 1
        stateModuleUrls.delete(stateUrl)
      }
      const ident = 's' + (index + 1)
      nestedStateIdents[index] = ident
      return ident
    }
  })

  const helpers: string[] = []

  if (nestedStateUrls.length) {
    const idents = nestedStateIdents.join(',' + SPACE)
    const imports = nestedStateUrls
      .concat(Array.from(stateModuleUrls))
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

  const inlinedState = inlinedStateMap.get(state!)
  if (inlinedState) {
    const inlined = inlinedState
      .map(state => {
        return renderStateModule(
          state.id,
          globalCache.loaded[state.id],
          globalCachePath,
          true
        )
      })
      .join('')
      .replace(/\n/g, '\n  ')

    code =
      `Object.assign(globalCache.loaded, {${RETURN + INDENT}${inlined}})\n` +
      code
  }

  if (
    head.title ||
    head.stylesheet.length ||
    head.prefetch.length ||
    Object.keys(head.preload).length
  ) {
    const description = dataToEsm(head, '', (key, value) => {
      if (!value) return
      if (Array.isArray(value)) {
        // Omit empty arrays.
        return value.length ? undefined : ''
      }
      if ('value' in value) {
        // Convert head tag to its string value.
        return dataToEsm((value as ParsedHeadTag).value, '')
      }
      if (value.constructor == Object) {
        // Omit empty objects.
        return Object.keys(value).length ? undefined : ''
      }
    })
    helpers.push('describeHead')
    code = `describeHead("${path}",${SPACE}${description})\n` + code
  }

  if (preloadUrls?.length) {
    preloadUrls = preloadUrls.map(url => base + url)
    helpers.push('preloadModules')
    code = `preloadModules(${dataToEsm(preloadUrls, '')})\n` + code
  }

  if (inlinedState) {
    code = `import {globalCache} from "/@fs/${globalCachePath}"\n` + code
  }

  if (helpers.length) {
    code =
      `import {${SPACE + helpers.join(',' + SPACE) + SPACE}} from "${
        base + helpersId
      }"\n` + code
  }

  return code
}
