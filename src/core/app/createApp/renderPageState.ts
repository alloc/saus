import { INDENT, RETURN, SPACE } from '@/tokens'
import { dataToEsm } from '@/utils/dataToEsm'
import { ParsedHeadTag } from '@/utils/parseHead'
import { App, CommonServerProps } from '../types'

export const getPageStateFactory = (
  app: App,
  ctx: App.Context
): App['renderPageState'] =>
  function renderPageState(page, preloadUrls) {
    const { path, props, head } = page
    const { base } = ctx.config

    const clientProps = (props as CommonServerProps)._clientProps
    const stateModuleIds = new Set(
      props._included.map(loaded => loaded.module.id)
    )

    const nestedStateIds: string[] = []
    const nestedStateIdents: string[] = []

    let code = dataToEsm(clientProps, null, (_, value) => {
      const inlinedStateId = value && value['@import']
      if (inlinedStateId) {
        let index = nestedStateIds.indexOf(inlinedStateId)
        if (index < 0) {
          index = nestedStateIds.push(inlinedStateId) - 1
          stateModuleIds.delete(inlinedStateId)
        }
        const ident = 's' + (index + 1)
        nestedStateIdents[index] = ident
        return ident
      }
    })

    const imports = new Map<string, string[]>()

    if (props._inlined.length) {
      const inlined = props._inlined.map(loaded => {
        const { module } = loaded
        return app.renderStateModule(
          (module.parent || module).id,
          module.args || [],
          loaded.state,
          loaded.expiresAt,
          true
        )
      })

      imports.set(base + ctx.config.clientCacheId, ['setState'])
      code = wrap(inlined.join('\n'), RETURN) + '\n' + code
    }

    const helpers: string[] = []

    if (nestedStateIds.length) {
      helpers.push('importStateModules')
      const idents = nestedStateIdents.join(',' + SPACE)
      code =
        `const [${idents}] = await importStateModules(${wrap(
          nestedStateIds
            .map(quoteIndent)
            .concat(Array.from(stateModuleIds, quoteIndent))
            .join(',' + RETURN),
          RETURN
        )})\n` + code
    } else if (stateModuleIds.size) {
      helpers.push('importStateModules')
      code =
        `await importStateModules(${wrap(
          Array.from(stateModuleIds, quoteIndent).join(',' + RETURN),
          RETURN
        )})\n` + code
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

    if (helpers.length) {
      imports.set(base + ctx.config.clientHelpersId, helpers)
    }

    if (imports.size) {
      code =
        Array.from(
          imports,
          ([source, specifiers]) =>
            `import {${wrap(
              specifiers.join(',' + SPACE),
              SPACE
            )}} from "${source}"`
        ).join('\n') +
        '\n' +
        code
    }

    return code
  }

function quoteIndent(str: string) {
  return INDENT + wrap(str, '"')
}

function wrap(wrapped: string, wrapper: string) {
  return wrapper + wrapped + wrapper
}
