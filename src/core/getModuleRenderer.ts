import { inlinedStateMap } from './app/global'
import type { AppContext, RenderedPage } from './app/types'
import type { CommonClientProps } from './client'
import { globalCache } from './runtime/cache'
import { stateModuleArguments } from './runtime/loadStateModule'
import type { CacheEntry } from './runtime/withCache'
import { INDENT, RETURN, SPACE } from './tokens'
import { prependBase } from './utils/base'
import { dataToEsm } from './utils/dataToEsm'
import { ParsedHeadTag } from './utils/parseHead'

export interface CommonServerProps extends CommonClientProps {
  _client: CommonClientProps
  _ts?: number
}

/**
 * This object is responsible for rendering:
 * - the entry module of each page
 * - any state modules used by your site
 */
export interface ModuleRenderer {
  /**
   * The entry module of a specific page, which includes page-specific state,
   * possibly some `<head>` tags, and preloaded state modules.
   */
  renderPageState(
    { path, props, stateModules, head }: RenderedPage,
    preloadUrls?: string[]
  ): string
  /**
   * Convert a "state module" (defined with a build-time `defineStateModule` call)
   * into an ES module that is ready for the browser. Once loaded, their state is
   * stored in the client's global cache, which allows for synchronous access via
   * the `StateModule#get` method.
   */
  renderStateModule(
    cacheKey: string,
    cachedState: CacheEntry<any>,
    inline?: boolean
  ): string
}

export function getModuleRenderer(context: AppContext): ModuleRenderer {
  const { config: runtimeConfig } = context
  const { debugBase = '' } = runtimeConfig

  const self: ModuleRenderer = {
    renderPageState(page, preloadUrls) {
      const { path, props, stateModules, head, isDebug } = page

      const { base, stateModuleBase } = runtimeConfig
      const toStateUrl = (id: string) =>
        prependBase(stateModuleBase + id + '.js', base)

      const clientProps = (props as CommonServerProps)._client
      const stateModuleUrls = new Set(stateModules.map(toStateUrl))
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

      const inlinedState = inlinedStateMap.get(props!)
      if (inlinedState) {
        const inlined = Array.from(inlinedState, state => {
          return self.renderStateModule(
            state.id,
            globalCache.loaded[state.id],
            true
          )
        })
          .join(RETURN)
          .replace(/\n/g, '\n  ')

        const stateCacheUrl = prependBase(runtimeConfig.clientCacheId!, base)
        imports.set(stateCacheUrl, ['globalCache'])
        code =
          `Object.assign(globalCache.loaded, {` +
          (RETURN + INDENT + inlined + RETURN) +
          `})\n` +
          code
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
          `await Promise.all([${RETURN + imports.join(RETURN) + RETURN}])\n` +
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

      if (helpers.length) {
        const helpersId =
          base +
          (isDebug ? debugBase.slice(1) : '') +
          context.config.clientHelpersId

        imports.set(helpersId, helpers)
      }

      if (imports.size) {
        code =
          Array.from(
            imports,
            ([source, specifiers]) =>
              `import {${
                SPACE + specifiers.join(',' + SPACE) + SPACE
              }} from "${source}"`
          ).join('\n') +
          '\n' +
          code
      }

      return code
    },
    renderStateModule(cacheKey, [state, ...config], inline) {
      let lines: string[]
      if (inline) {
        const cacheEntry = dataToEsm([state, ...config], '')
        lines = [`"${cacheKey}": ${cacheEntry},`]
      } else {
        const cacheEntry = 'state' + commaDelimited(config)
        const stateCacheUrl = prependBase(
          runtimeConfig.clientCacheId!,
          runtimeConfig.base!
        )
        lines = [
          `import { globalCache } from "${stateCacheUrl}"`,
          dataToEsm(state, 'state'),
          `globalCache.loaded["${cacheKey}"] = [${cacheEntry}]`,
          `export default state`,
        ]
      }
      const args = stateModuleArguments.get(cacheKey)
      const argsComment = args ? `/* ${JSON.stringify(args)} */\n` : ``
      return argsComment + lines.join('\n')
    },
  }

  return self
}

function commaDelimited(arr: any[]) {
  return arr.map(value => ', ' + dataToEsm(value, '')).join('')
}
