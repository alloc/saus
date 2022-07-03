import { App } from '@/app/types'
import { removeSourceMapUrls } from '@/node/sourceMap'
import { globalCache } from '@/runtime/cache'
import { prependBase } from '@/utils/base'
import { getPageFilename } from '@/utils/getPageFilename'
import { isCSSRequest } from '@/utils/isCSSRequest'
import { isExternalUrl } from '@/utils/isExternalUrl'
import { getPreloadTagsForModules } from '@/vite/modulePreload'
import { injectToBody, injectToHead } from '../../html/inject'
import { HtmlTagDescriptor } from '../../html/types'
import { applyHtmlProcessors, endent } from '../core/api'
import config from './config'
import { context } from './context'
import { injectDebugBase } from './debugBase'
import { getModuleUrl } from './getModuleUrl'
import { PageBundle } from './types'

const hydrateImport = `import { hydrate } from "saus/client"`

export const createPageFactory: App.Plugin = app => {
  const { config, renderPageState, renderStateModule } = app

  // Enable "debug view" when this begins the URL pathname.
  const debugBase = config.debugBase || ''

  // Prepended to module IDs in debug view.
  const debugDir = debugBase.slice(1)

  return {
    async renderPageBundle(url, route, options = {}) {
      const { renderStart, renderFinish } = options

      // Let's assume `config.base` is already stripped.
      let base = '/'
      let baseDir = ''
      let isDebug = false
      if (debugBase && url.startsWith(debugBase)) {
        base = debugBase
        baseDir = debugDir
        isDebug = true
      }

      // Page caching includes the query string.
      const pageRelativeUrl = url.toString()

      if (renderStart && context.getCachedPage(pageRelativeUrl)) {
        renderStart(url)
      }

      const [page, error] = await app.renderPage(url, route, {
        defaultRoute: !/\.[^./]+$/.test(url.path) && context.defaultRoute,
        ...options,
        isDebug,
        renderStart: renderStart && (() => renderStart(url)),
        renderFinish: undefined,
      })

      if (page) {
        page.isDebug = isDebug
      }

      options.receivePage?.(page, error)

      if (error) {
        if (renderFinish) {
          renderFinish(url, error)
          return null
        }
        throw error
      }
      if (!page) {
        renderFinish?.(url, null, null)
        return null
      }

      const isDefaultPage = page.props.routePath == 'default'
      const filename = getPageFilename(
        isDefaultPage ? prependBase(config.defaultPath, base) : url.path
      )

      if (!page.html) {
        const finishedPage: PageBundle = {
          id: filename,
          html: '',
          routeModuleId: page.route.moduleId!,
          files: page.files,
        }
        renderFinish?.(url, null, finishedPage)
        return finishedPage
      }

      const bodyTags: HtmlTagDescriptor[] = []

      // Share the state cache and state modules b/w debug and production views.
      const stateCacheId = config.stateCacheId.slice(1)
      const stateModuleBase = config.stateModuleBase.slice(1)

        // State modules are not renamed for debug view.
        for (const stateId of [...page.stateModules].reverse()) {
          const stateModuleId = stateModuleBase + stateId + '.js'
          const stateModuleText = renderStateModule(
            stateId,
            globalCache.loaded[stateId]
          )
          page.files.push({
            id: stateModuleId,
            data: Buffer.from(stateModuleText),
            mime: 'application/javascript',
          })
        }

        // The hydrating module is inlined.
        // const hydrateModule = clientModules[clientModules[hydrateImport]]
        // hydrateModule.imports?.forEach(addModule)

      const pageStateId = filename + '.js'
      const routeModuleUrl = getModuleUrl(page.route.moduleId)
        const entryModuleUrl = getModuleUrl(entryModule)

        // Hydrate the page. The route module is imported dynamically to ensure
        // it's executed *after* the page state module is.
        bodyTags.push({
          tag: 'script',
          attrs: { type: 'module' },
          children: endent`
            import pageState from "${config.base + pageStateId}"
            ${removeSourceMapUrls(
              await (isDebug
                ? rewriteImports(hydrateModule, new Set(), base, skipDebugBase)
                : loadModule(hydrateModule.id))
            )}

            Promise.all([
              import("${routeModuleUrl}"),
              import("${entryModuleUrl}")
            ]).then(([routeModule]) =>
              hydrate(pageState, routeModule, "${routeModuleUrl}")
            )
          `,
        })
      }

      let html = page.html

      if (config.stripLinkTags)
        page.head.stylesheet
          .concat(page.head.prefetch, ...Object.values(page.head.preload))
          .sort((a, b) => b.start - a.start)
          .forEach(tag => {
            html = html.slice(0, tag.start) + html.slice(tag.end)
          })

      if (bodyTags.length) {
        html = injectToBody(html, bodyTags)
      }

      let postHtmlProcessors = context.htmlProcessors?.post || []
      if (isDebug) {
        postHtmlProcessors = [
          ...postHtmlProcessors,
          // SSR modules are unaware of the `isDebug` value, so they never use
          // the `debugBase` when rendering local URLs. Therefore, we need to
          // scan the HTML for links and rewrite them for the debug view.
          injectDebugBase(debugBase),
        ]
      }

      const { files } = page
      return applyHtmlProcessors(
        html,
        postHtmlProcessors,
        { page, config, assets },
        config.htmlTimeout
      ).then(async html => {
        const [styleUrls, assetUrls] = generateAssetUrls(assets)

        if (page && entryModule) {
          const existingLinks = new Set(
            page.head.stylesheet
              .concat(page.head.prefetch, ...Object.values(page.head.preload))
              .map(tag => tag.value)
          )

          for (const styleUrl of styleUrls) {
            if (!existingLinks.has(styleUrl)) {
              page.head.stylesheet.push({
                value: styleUrl,
                start: -1,
                end: -1,
              })
            }
          }
          for (const assetUrl of assetUrls) {
            if (!existingLinks.has(assetUrl)) {
              page.head.prefetch.push({ value: assetUrl, start: -1, end: -1 })
            }
          }

          // The page's state module is rendered after HTML post processors
          // run to ensure all <link> tags are included.
          page.files.push({
            id: pageStateId,
            data: Buffer.from(renderPageState(page)),
            mime: 'application/javascript',
          })
        }

        if (!config.stripLinkTags) {
          const headTags: HtmlTagDescriptor[] = []

          getTagsForStyles(styleUrls, headTags)
          getTagsForAssets(assetUrls, headTags)

          if (headTags.length) {
            html = injectToHead(html, headTags, true)
            headTags.length = 0
          }

          const moduleUrls = !config.delayModulePreload
            ? Array.from(modules, getModuleUrl)
            : entryModule
            ? [getModuleUrl(pageStateId)]
            : null

          if (moduleUrls) {
            getPreloadTagsForModules(moduleUrls, headTags)
            html = injectToHead(html, headTags)
          }
        }

        const finishedPage: PageBundle = {
          id: filename,
          html,
          routeModuleId: page.route.moduleId,
          files,
        }

        renderFinish?.(url, null, finishedPage)
        return finishedPage
      })
    },
  }
}

function generateAssetUrls(assetIds: Iterable<string>) {
  const styleUrls: string[] = []
  const assetUrls: string[] = []
  for (const assetId of assetIds) {
    const url = isExternalUrl(assetId) ? assetId : config.base + assetId
    if (isCSSRequest(url)) {
      styleUrls.push(url)
    } else {
      assetUrls.push(url)
    }
  }
  return [styleUrls, assetUrls] as const
}

function getTagsForStyles(styleUrls: string[], headTags: HtmlTagDescriptor[]) {
  for (const url of styleUrls) {
    headTags.push({
      tag: 'link',
      attrs: {
        rel: 'stylesheet',
        href: url,
      },
    })
  }
}

function getTagsForAssets(assetUrls: string[], headTags: HtmlTagDescriptor[]) {
  for (const url of assetUrls) {
    headTags.push({
      tag: 'link',
      attrs: {
        rel: 'prefetch',
        href: url,
      },
    })
  }
}
