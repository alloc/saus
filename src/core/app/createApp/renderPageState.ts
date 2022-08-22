import { INDENT, RETURN, SPACE } from '@/tokens'
import { prependBase } from '@/utils/base'
import { dataToEsm } from '@/utils/dataToEsm'
import { ParsedHeadTag } from '@/utils/parseHead'
import { App, CommonServerProps } from '../types'

export const getPageStateFactory = (
  app: App,
  ctx: App.Context
): App['renderPageState'] =>
  function renderPageState(page, preloadUrls) {
    const { path, props, head, isDebug } = page

    const { base, stateModuleBase } = ctx.config
    const toStateUrl = (id: string) =>
      prependBase(stateModuleBase + id + '.js', base)

    const clientProps = (props as CommonServerProps)._clientProps
    const stateModuleUrls = new Set(
      props._included.map(loaded => toStateUrl(loaded.module.id))
    )

    const nestedStateUrls: string[] = []
    const nestedStateIdents: string[] = []

    let code = dataToEsm(clientProps, null, (_, value) => {
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

      const stateCacheUrl = prependBase(ctx.config.clientCacheId, base)
      imports.set(stateCacheUrl, ['setState'])
      code = wrap(inlined.join('\n'), RETURN) + '\n' + code
    }

    const helpers: string[] = []

    if (nestedStateUrls.length) {
      const idents = nestedStateIdents.join(',' + SPACE)
      const imports = nestedStateUrls
        .concat(Array.from(stateModuleUrls))
        .map(url => INDENT + `import("${url}"),`)

      helpers.push('resolveModules')
      code =
        `const [${idents}] = await resolveModules(` +
        wrap(imports.join(RETURN), RETURN) +
        `)\n` +
        code
    } else if (stateModuleUrls.size) {
      const imports = Array.from(
        stateModuleUrls,
        url => INDENT + `import("${url}"),`
      )
      code =
        `await Promise.all([${wrap(imports.join(RETURN), RETURN)}])\n` + code
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
      const helpersId =
        base +
        (isDebug ? ctx.config.debugBase!.slice(1) : '') +
        ctx.config.clientHelpersId

      imports.set(helpersId, helpers)
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

function wrap(wrapped: string, wrapper: string) {
  return wrapper + wrapped + wrapper
}
