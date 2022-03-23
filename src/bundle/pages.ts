import path from 'path'
import { isMainThread } from 'worker_threads'
import { renderPageState } from '../core/renderPageState'
import { renderStateModule } from '../core/renderStateModule'
import { createRenderPageFn } from '../pages/renderPage'
import { globalCache } from '../runtime/cache'
import { getPageFilename } from '../utils/getPageFilename'
import { parseImports } from '../utils/imports'
import { isCSSRequest } from '../utils/isCSSRequest'
import { isExternalUrl } from '../utils/isExternalUrl'
import { getPreloadTagsForModules } from '../utils/modulePreload'
import { removeSourceMapUrls } from '../utils/sourceMap'
import { ParsedUrl, parseUrl } from '../utils/url'
import moduleMap from './moduleMap'
import inlinedModules from './inlinedModules'
import config from './config'
import { context } from './context'
import { applyHtmlProcessors, endent, __exportAll } from './core'
import { injectDebugBase } from './debugBase'
import { defineClientEntry } from './defineClientEntry'
import functions from './functions'
import { getModuleUrl } from './getModuleUrl'
import { injectToBody, injectToHead } from './html/inject'
import { HtmlTagDescriptor } from './html/types'
import { loadRenderers } from './render'
import { ssrClearCache, ssrImport } from './ssrModules'
import {
  ClientAsset,
  ClientModule,
  RenderedPage,
  RenderPageOptions,
} from './types'
import getModuleLoader from './moduleLoader'
import getAssetLoader from './assetLoader'
import { stateModuleBase } from '../runtime/constants'

// Allow `ssrImport("saus/client")` outside page rendering.
defineClientEntry()

const { loadModule } = getModuleLoader()
const { loadAsset } = getAssetLoader()

// Avoid string duplication in the inlined module cache
// by setting their `id` property at runtime.
for (const id in inlinedModules) {
  inlinedModules[id].id = id
}

const hydrateImport = `import { hydrate } from "saus/client"`
const requestPage = createRenderPageFn(
  context,
  functions,
  config,
  // Load the routes module.
  () => ssrImport(config.ssrRoutesId)
)

// Enable "debug view" when this begins the URL pathname.
const debugBase = config.debugBase
  ? config.base.replace(/\/$/, config.debugBase)
  : ''

// Prepended to module IDs in debug view.
const debugDir = (config.debugBase || '').slice(1)

type InternalPage = import('../pages/types').RenderedPage

export async function renderPage(
  pageUrl: string | ParsedUrl,
  { renderStart, renderFinish, ...renderOptions }: RenderPageOptions = {}
): Promise<RenderedPage | null> {
  let base = config.base
  if (!pageUrl.startsWith(base)) {
    return null
  }

  let isDebug = false
  if (debugBase && pageUrl.startsWith(debugBase)) {
    base = debugBase
    isDebug = true
  }

  pageUrl = pageUrl.slice(base.length - 1)
  if (typeof pageUrl == 'string') {
    pageUrl = parseUrl(pageUrl)
  }

  // When loading renderers, the `base` is omitted.
  const pageRenderPath = pageUrl.path
  const pagePublicPath = base + pageRenderPath.slice(1)

  let page: InternalPage | null = null
  try {
    if (renderStart && context.getCachedPage(pageUrl.path)) {
      renderStart(pagePublicPath)
    }
    page = await requestPage(pageUrl, {
      ...renderOptions,
      renderStart: renderStart && (() => renderStart(pagePublicPath)),
      // Prepare the page context with isolated modules.
      async setup(pageContext) {
        ssrClearCache()
        defineClientEntry({
          BASE_URL: isDebug ? debugBase : base,
        })
        context.renderers = []
        context.defaultRenderer = undefined
        context.beforeRenderHooks = []
        await loadRenderers(pageRenderPath)
        Object.assign(pageContext, context)
      },
    })
  } catch (error: any) {
    if (renderFinish) {
      renderFinish(pagePublicPath, error)
      return null
    }
    throw error
  }
  if (!page) {
    renderFinish?.(pagePublicPath, null, null)
    return null
  }

  // Preserve the debug base, but not the base base. Ha!
  const pagePath = pagePublicPath.replace(config.base, '/')
  const filename = getPageFilename(pagePath)
  const pageStateId = filename + '.js'

  if (!page.html) {
    const finishedPage: RenderedPage = {
      id: filename,
      html: '',
      modules: new Set(),
      assets: new Map(),
      files: page.files,
    }
    renderFinish?.(pagePublicPath, null, finishedPage)
    return finishedPage
  }

  const seen = new Set<ClientModule>()
  const modules = new Set<ClientModule>()
  const assets = new Set<string>()

  const addModule = (id: string) => {
    let module = inlinedModules[id]
    if (!module) {
      assets.add(id)
      return null
    }
    if (seen.has(module)) {
      return module
    }
    seen.add(module)
    module.imports?.forEach(addModule)
    if (module.id.endsWith('.js')) {
      if (isDebug && module.debugText) {
        module = {
          ...module,
          id: debugDir + module.id,
          text: module.debugText,
          debugText: undefined,
        }
      }
      modules.add(module)
    }
    return module
  }

  const bodyTags: HtmlTagDescriptor[] = []

  // Share the state cache and state modules b/w debug and production views.
  const preserveBase = (id: string) =>
    id == config.stateCacheId ||
    (id.startsWith(stateModuleBase.slice(1)) && id.endsWith('.js'))

  const routeModule = addModule(moduleMap[page.routeModuleId])!
  const entryId = page.client
    ? path.join(config.assetsDir, page.client.id)
    : null!

  // The entry module is generated by the renderer package. It contains logic
  // from the render hooks used to pre-render *and* hydrate this page.
  const entryModule: ClientModule | undefined = page.client && {
    id: (isDebug ? debugDir : '') + entryId,
    text: page.client.code,
  }

  let preloadList: string[] | undefined

  // No point in loading any JS if no entry module exists.
  if (entryModule) {
    const entryImports = new Set<string>()
    entryModule.text = await rewriteImports(
      entryModule,
      entryImports,
      base,
      preserveBase
    )
    entryModule.imports = Array.from(entryImports)
    entryModule.imports.forEach(addModule)
    modules.add(entryModule)

    // Anything imported by either the route module or the entry module is
    // pre-loaded by the page state module to speed up page navigation.
    preloadList = await getPreloadList([routeModule, entryModule], isDebug)

    // State modules are not renamed for debug view.
    for (const stateId of [...page.stateModules].reverse()) {
      const stateModuleId = stateModuleBase.slice(1) + stateId + '.js'
      modules.add({
        id: stateModuleId,
        text: renderStateModule(
          stateId,
          globalCache.loaded[stateId],
          config.base + config.stateCacheId
        ),
        exports: ['default'],
      })
    }

    // The hydrating module is inlined.
    const hydrateModule = inlinedModules[moduleMap[hydrateImport]]
    const hydrateText = removeSourceMapUrls(
      isDebug
        ? await rewriteImports(hydrateModule, new Set(), base, preserveBase)
        : await loadModule(hydrateModule.id)
    )
    hydrateModule.imports?.forEach(addModule)

    const routeModuleUrl = getModuleUrl(routeModule)
    const entryModuleUrl = getModuleUrl(entryModule)

    // Hydrate the page. The route module is imported dynamically to ensure
    // it's executed *after* the page state module is.
    bodyTags.push({
      tag: 'script',
      attrs: { type: 'module' },
      children: endent`
        import pageState from "${config.base + pageStateId}"
        ${hydrateText}

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
    const assetMap = new Map<string, ClientAsset>(
      await Promise.all(
        Array.from(assets)
          .filter(assetId => !isExternalUrl(assetId))
          .map(async assetId => {
            let data: ClientAsset = await loadAsset(assetId)

            // When `data` is a Node buffer, we cannot be sure if it can
            // be safely copied between threads, since it may have been
            // allocated with `Buffer.from` (which uses object pooling).
            // An explicit copy into a non-pooled buffer is the only
            // way to make sure the data won't get corrupted.
            if (!isMainThread && Buffer.isBuffer(data)) {
              const nonPooled = Buffer.alloc(data.byteLength)
              data.copy(nonPooled)
              data = nonPooled.buffer
            }

            return [assetId, data] as const
          })
      )
    )

    const [styleUrls, assetUrls] = generateAssetUrls(assets)

    if (page && entryModule) {
      const existingLinks = new Set(
        page.head.stylesheet
          .concat(page.head.prefetch, ...Object.values(page.head.preload))
          .map(tag => tag.value)
      )

      for (const styleUrl of styleUrls) {
        if (!existingLinks.has(styleUrl)) {
          page.head.stylesheet.push({ value: styleUrl, start: -1, end: -1 })
        }
      }
      for (const assetUrl of assetUrls) {
        if (!existingLinks.has(assetUrl)) {
          page.head.prefetch.push({ value: assetUrl, start: -1, end: -1 })
        }
      }

      // The page's state module is rendered after HTML post processors
      // run to ensure all <link> tags are included.
      modules.add({
        id: pageStateId,
        text: renderPageState(
          page,
          config.base,
          moduleMap.helpers,
          preloadList
        ),
        exports: ['default'],
      })

      // The helpers module is used by every page's state module.
      addModule(moduleMap.helpers)
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

    const finishedPage: RenderedPage = {
      id: filename,
      html,
      files,
      modules,
      assets: assetMap,
    }

    renderFinish?.(pagePublicPath, null, finishedPage)
    return finishedPage
  })
}

async function rewriteImports(
  importer: ClientModule,
  imported: Set<string>,
  resolvedBase: string,
  preserveBase?: (id: string) => boolean
): Promise<string> {
  const importerText = importer.text ?? (await loadModule(importer.id))
  const isBaseReplaced = config.base !== resolvedBase
  const splices: Splice[] = []
  for (const importStmt of parseImports(importerText)) {
    const source = importStmt.source.value

    let resolvedId: string | undefined
    let resolvedUrl: string | undefined
    if (source.startsWith(config.base)) {
      resolvedId = source.replace(config.base, '')
    }

    const module =
      (resolvedId && inlinedModules[resolvedId]) ||
      inlinedModules[moduleMap[importStmt.text]]

    if (!module) {
      console.warn(`Unknown module "${source}" imported by "${importer.id}"`)
      continue
    }

    let hasReplacedBase: boolean | undefined
    if (resolvedId) {
      hasReplacedBase =
        isBaseReplaced && !(preserveBase && preserveBase(module.id))
      resolvedUrl = hasReplacedBase
        ? source.replace(config.base, resolvedBase)
        : source
    }

    if (module.exports) {
      imported.add(module.id)
      if (!resolvedId || hasReplacedBase) {
        resolvedId = module.id
        resolvedUrl = resolvedBase + resolvedId

        splices.push([
          importStmt.source.start,
          importStmt.source.end,
          resolvedUrl,
        ])
      }
    } else {
      // Modules that export nothing are inlined.
      const text = removeSourceMapUrls(
        module.imports
          ? await rewriteImports(module, imported, resolvedBase, preserveBase)
          : module.text ?? (await loadModule(module.id))
      )

      splices.push([importStmt.start, importStmt.end, text])
    }
  }
  return applySplices(importerText, splices)
}

type Splice = [start: number, end: number, replacement: string]

function applySplices(text: string, splices: Splice[]) {
  let cursor = text.length
  splices.reverse().forEach((splice, i) => {
    const end = Math.min(splice[1], cursor)
    cursor = splice[0]
    text = text.slice(0, cursor) + splice[2] + text.slice(end)
  })
  return text
}

async function getPreloadList(
  entries: (ClientModule | undefined)[],
  isDebug: boolean
): Promise<string[]> {
  const preloadList: string[] = []
  const modules = new Set(entries)
  modules.forEach(module => {
    if (module) {
      let preloadId = module.id
      if (isDebug && !entries.includes(module)) {
        preloadId = debugDir + preloadId
      }
      preloadList.push(preloadId)
      module.imports?.forEach(id => {
        modules.add(inlinedModules[id])
      })
    }
  })
  return preloadList
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
