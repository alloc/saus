import { getPreloadTagsForModules } from '@/vite/modulePreload'
import { collectStateFiles } from '@runtime/app/collectStateFiles'
import { App, CommonServerProps, ResolvedRoute } from '@runtime/app/types'
import { PageBundle } from '@runtime/bundleTypes'
import { waitForCachePlugin } from '@runtime/cachePlugin'
import { RuntimeConfig } from '@runtime/config'
import { getLayoutEntry } from '@runtime/getLayoutEntry'
import { applyHtmlProcessors } from '@runtime/html/process'
import { makeRequestUrl } from '@runtime/makeRequest'
import { renderPageScript } from '@runtime/renderPageScript'
import { parseUrl } from '@runtime/url'
import { prependBase } from '@utils/base'
import { getPageFilename } from '@utils/getPageFilename'
import { isExternalUrl } from '@utils/isExternalUrl'
import { Promisable } from 'type-fest'
import { injectToBody, injectToHead } from '../../html/inject'
import { HtmlTagDescriptor } from '../../html/types'
import clientEntries from './clientEntries'
import clientStyles from './clientStyles'
import { context } from './context'
import { injectDebugBase } from './debugBase'

export const providePageBundles: App.Plugin = app => {
  const { config } = app

  // Enable "debug view" when this begins the URL pathname.
  const debugBase = config.debugBase || ''

  return {
    async resolvePageBundle(url, options = {}) {
      const req = makeRequestUrl(parseUrl(url), {
        headers: { accept: 'text/html' },
      })
      let resolved: ResolvedRoute | undefined
      while ((resolved = app.resolveRoute(req, resolved?.remainingRoutes))) {
        if (resolved.route?.moduleId) {
          let page: Promisable<PageBundle | null> | undefined
          await app.renderPageBundle(req, resolved.route, {
            ...options,
            renderFinish(_, error, result) {
              if (error) {
                if (!app.catchRoute) {
                  throw error
                }
                page = app.renderPageBundle(req, app.catchRoute, options)
              } else if (result) {
                page = result
                options.renderFinish?.(req, null, page)
              }
            },
          })
          if ((page = await page)) {
            return page
          }
        }
      }
      return null
    },
    async renderPageBundle(url, route, options = {}) {
      const { renderStart, renderFinish } = options

      // Let's assume `config.base` is already stripped.
      let base = '/'
      let isDebug = false
      if (debugBase && url.startsWith(debugBase)) {
        base = debugBase
        isDebug = true
      }

      // Page caching includes the query string.
      const pageRelativeUrl = url.toString()

      if (renderStart && context.pageCache.has(pageRelativeUrl)) {
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

      const { files } = page

      if (!page.html) {
        const finishedPage: PageBundle = {
          id: filename,
          html: '',
          files,
        }
        renderFinish?.(url, null, finishedPage)
        return finishedPage
      }

      const bodyTags: HtmlTagDescriptor[] = []

      // State modules are not renamed for debug view.
      collectStateFiles(files, page.props._included, app)

      // If the route fails to render, the catch route is used instead.
      route = page.route

      const assets = new Set<string>()

      let routeClientId: string | undefined
      let pageStateId: string | undefined

      if (route.moduleId) {
        const routeLayoutId = getLayoutEntry(route, config.defaultLayout.id)
        routeClientId = clientEntries[routeLayoutId][route.moduleId]
        clientStyles[routeClientId].forEach(styleId => assets.add(styleId))
        pageStateId = filename + '.js'
        bodyTags.push({
          tag: 'script',
          attrs: { type: 'module' },
          children: renderPageScript({
            pageStateId: '/' + pageStateId,
            sausClientId: base + config.clientHelpersId,
            routeClientId: base + routeClientId,
          }),
        })
      }

      let html = page.html
      if (bodyTags.length) {
        html = injectToBody(html, bodyTags)
      }

      let postHtmlProcessors = context.htmlProcessors?.post || []
      if (isDebug) {
        postHtmlProcessors = [
          ...postHtmlProcessors,
          // SSR modules are unaware of the `isDebug` value, so they
          // never use the `debugBase` when rendering local URLs.
          // Therefore, we need to scan the HTML for links and rewrite
          // them for the debug view.
          injectDebugBase(debugBase),
        ]
      }

      return applyHtmlProcessors(
        html,
        postHtmlProcessors,
        { page, config, assets },
        config.htmlTimeout
      ).then(async html => {
        const [styleUrls, assetUrls] = generateAssetUrls(assets, config)

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

        // The page's state module is rendered after HTML post
        // processors run to ensure all <link> tags are included.
        if (pageStateId) {
          const pageProps = page.props as CommonServerProps
          files.push({
            id: pageStateId,
            get data() {
              return app.renderPageState(page)
            },
            mime: 'application/javascript',
            expiresAt:
              pageProps._maxAge != null
                ? pageProps._ts + pageProps._maxAge
                : undefined,
          })
        }

        const headTags: HtmlTagDescriptor[] = []

        getTagsForStyles(styleUrls, headTags)
        getTagsForAssets(assetUrls, headTags)

        // Prepend stylesheet + prefetch tags
        if (headTags.length) {
          html = injectToHead(html, headTags, true)
          headTags.length = 0
        }

        // Append modulepreload tag if the page is hydrated
        if (pageStateId) {
          getPreloadTagsForModules([config.base + pageStateId], headTags)
          html = injectToHead(html, headTags)
        }

        // Wait for pending cache updates that the page may depend on.
        await waitForCachePlugin(
          page.props._included.map(loaded => loaded.stateModule.key)
        )

        const finishedPage: PageBundle = {
          id: filename,
          html,
          files,
        }

        renderFinish?.(url, null, finishedPage)
        return finishedPage
      })
    },
  }
}

function generateAssetUrls(assetIds: Iterable<string>, config: RuntimeConfig) {
  const styleUrls: string[] = []
  const assetUrls: string[] = []
  for (const assetId of assetIds) {
    const url = isExternalUrl(assetId) ? assetId : config.base + assetId
    if (url.endsWith('.css')) {
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
