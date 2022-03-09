import path from 'path'
import { renderPageState } from '../core/renderPageState'
import { renderStateModule } from '../core/renderStateModule'
import { createPageFactory } from '../pages'
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
import { ClientModule, RenderedPage, RenderPageOptions } from './types'
import getModuleLoader from './moduleLoader'
import getAssetLoader from './assetLoader'

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
const pageFactory = createPageFactory(
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
  { timeout, renderStart, renderFinish }: RenderPageOptions = {}
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
    page = await pageFactory.render(pageUrl, {
      timeout,
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

  const headTags: HtmlTagDescriptor[] = []
  const bodyTags: HtmlTagDescriptor[] = []

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

  // No point in loading any JS if no entry module exists.
  if (entryModule) {
    const entryImports = new Set<string>()
    entryModule.text = await rewriteImports(entryModule, entryImports, base)
    entryModule.imports = Array.from(entryImports)
    entryModule.imports.forEach(addModule)
    modules.add(entryModule)

    // Anything imported by either the route module or the entry module is
    // pre-loaded by the page state module to speed up page navigation.
    const preloadList = await getPreloadList(
      [routeModule, entryModule],
      isDebug
    )

    // The "page state module" initializes the global state cache with any
    // state modules used by the route module or entry module. It also
    // provides the top-level state of the `RenderRequest` object.
    const pageStateId = filename + '.js'
    modules.add({
      id: pageStateId,
      text: renderPageState(
        page,
        config.base,
        inlinedModules.helpers.id,
        preloadList
      ),
      exports: ['default'],
      get imports() {
        return parseImports(this.text).map(
          importDecl => importDecl.source.value
        )
      },
    })

    // State modules are not renamed for debug view.
    for (const stateId of [...page.stateModules].reverse()) {
      const stateModuleId = 'state/' + stateId + '.js'
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
        ? await rewriteImports(hydrateModule, new Set(), base)
        : await loadModule(hydrateModule.id)
    )
    hydrateModule.imports?.forEach(addModule)

    // Hydrate the page. The route module is imported dynamically to ensure
    // it's executed *after* the page state module is.
    const routeModuleUrl = getModuleUrl(routeModule)
    const entryModuleUrl = getModuleUrl(entryModule)
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
    const assetMap = new Map(
      await Promise.all(
        Array.from(assets)
          .filter(assetId => !isExternalUrl(assetId))
          .map(async assetId => {
            const data = await loadAsset(assetId)
            return [assetId, data] as const
          })
      )
    )

    getPreloadTagsForModules(Array.from(modules, getModuleUrl), headTags)
    getTagsForAssets(assets, headTags)
    html = injectToHead(html, headTags)

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
  resolvedBase: string
): Promise<string> {
  const importerText = await loadModule(importer.id)
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

    if (resolvedId) {
      resolvedUrl = isBaseReplaced
        ? source.replace(config.base, resolvedBase)
        : source
    }

    if (module.exports) {
      imported.add(module.id)
      if (!resolvedId || isBaseReplaced) {
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
          ? await rewriteImports(module, imported, resolvedBase)
          : await loadModule(module.id)
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

function getTagsForAssets(
  assetIds: Iterable<string>,
  headTags: HtmlTagDescriptor[]
) {
  for (const assetId of assetIds) {
    const url = isExternalUrl(assetId) ? assetId : config.base + assetId
    if (isCSSRequest(url)) {
      headTags.push({
        tag: 'link',
        attrs: {
          rel: 'stylesheet',
          href: url,
        },
      })
    } else {
      // TODO: preload other assets
    }
  }
}
