import path from 'path'
import { renderPageState } from '../../core/renderPageState'
import { renderStateModule } from '../../core/renderStateModule'
import { createPageFactory } from '../../pages'
import { getPageFilename } from '../../utils/getPageFilename'
import { parseImports, serializeImports } from '../../utils/imports'
import { isCSSRequest } from '../../utils/isCSSRequest'
import { getPreloadTagsForModules } from '../../utils/modulePreload'
import { ParsedUrl, parseUrl } from '../../utils/url'
import { ssrClearCache, ssrRequire } from '../ssrModules'
import { ClientModule, RenderedPage, RenderPageOptions } from '../types'
import config from './config'
import { ssrRoutesId } from './constants'
import { context } from './context'
import { applyHtmlProcessors, endent } from './core'
import functions from './functions'
import { getModuleUrl } from './getModuleUrl'
import { HtmlTagDescriptor, injectToBody, injectToHead } from './html'
import moduleMap from './modules'
import { loadRenderers } from './render'

const hydrateImport = `import { hydrate } from "saus/client"`
const pageFactory = createPageFactory(
  context,
  functions,
  config,
  // Load the routes module.
  () => ssrRequire(ssrRoutesId)
)

type InternalPage = import('../../pages/types').RenderedPage

export async function renderPage(
  pageUrl: string | ParsedUrl,
  { renderStart, renderFinish }: RenderPageOptions = {}
): Promise<RenderedPage | null> {
  if (!pageUrl.startsWith(config.base)) {
    return null
  }

  pageUrl = pageUrl.slice(config.base.length - 1)
  if (typeof pageUrl == 'string') {
    pageUrl = parseUrl(pageUrl)
  }

  const pagePath = pageUrl.path

  let page: InternalPage | null = null
  try {
    page = await pageFactory.render(pageUrl, {
      renderStart,
      // Prepare the page context with isolated modules.
      async setup(pageContext) {
        ssrClearCache()
        context.renderers = []
        context.defaultRenderer = undefined
        context.beforeRenderHooks = []
        await loadRenderers(pagePath)
        Object.assign(pageContext, context)
      },
    })
  } catch (error: any) {
    if (renderFinish) {
      renderFinish(pagePath, error)
      return null
    }
    throw error
  }
  if (!page) {
    renderFinish?.(pagePath, null, null)
    return null
  }

  const filename = getPageFilename(pagePath)

  const seen = new Set<ClientModule>()
  const modules = new Set<ClientModule>()
  const assets = new Set<ClientModule>()

  const addModule = (key: string) => {
    const module = moduleMap[key]
    if (!module) {
      return null
    }
    if (seen.has(module)) {
      return module
    }
    seen.add(module)
    module.imports?.forEach(addModule)
    if (module.exports) {
      modules.add(module)
    } else if (!module.id.endsWith('.js')) {
      assets.add(module)
    }
    return module
  }

  const routeModule = addModule(page.routeModuleId)!
  const hydrateModule = addModule(hydrateImport)!

  const entryId = page.client
    ? path.join(config.assetsDir, page.client.id)
    : null!

  // The entry module that imports all other client modules.
  // Generated from the first matching `render` hook, its `didRender` hook
  // (if defined), and any matching `beforeRender` hooks.
  const entryModule: ClientModule | undefined = page.client && {
    id: entryId,
    text: page.client.code,
  }

  if (entryModule) {
    const entryImports = new Set<string>()
    entryModule.text = rewriteImports(entryModule, entryImports)
    entryModule.imports = Array.from(entryImports)
    entryModule.imports.forEach(addModule)
    modules.add(entryModule)
  }

  const preloadUrls = new Set([routeModule.id])
  routeModule.imports?.forEach(function preload(key: string) {
    const mod = moduleMap[key]
    if (!preloadUrls.has(mod.id)) {
      preloadUrls.add(mod.id)
      mod.imports?.forEach(preload)
    }
  })

  const pageStateId = filename + '.js'
  const pageStateImpl = renderPageState(
    page.state,
    config.base,
    moduleMap.helpers.id,
    Array.from(preloadUrls)
  )
  modules.add({
    id: pageStateId,
    text: pageStateImpl,
    imports: parseImports(pageStateImpl).map(
      importDecl => importDecl.source.value
    ),
    exports: ['default'],
  })

  for (const stateId of [...page.stateModules].reverse()) {
    const stateModuleId = 'state/' + stateId + '.js'
    modules.add({
      id: stateModuleId,
      text: renderStateModule(
        stateId,
        context.loadedStateCache.get(stateId),
        config.base + config.stateCacheUrl
      ),
      exports: ['default'],
    })
  }

  const headTags: HtmlTagDescriptor[] = []
  const bodyTags: HtmlTagDescriptor[] = []

  getPreloadTagsForModules(
    Array.from(modules, m => config.base + m.id),
    headTags
  )
  getTagsForAssets(assets, headTags)

  // Hydrate the page.
  bodyTags.push({
    tag: 'script',
    attrs: { type: 'module' },
    children: endent`
      import pageState from "${config.base + pageStateId}"
      import * as routeModule from "${getModuleUrl(routeModule)}"
      ${serializeImports(entryModule ? [config.base + entryModule.id] : [])}
      ${hydrateModule.text}
      hydrate(pageState, routeModule, "${config.base + routeModule.id}")
    `,
  })

  const html = injectToBody(injectToHead(page.html, headTags), bodyTags)
  return applyHtmlProcessors(
    html,
    { page, config, assets },
    context.htmlProcessors?.post || []
  ).then(html => {
    const finishedPage = {
      id: filename,
      html,
      modules,
      assets,
    }
    renderFinish?.(pagePath, null, finishedPage)
    return finishedPage
  })
}

type Splice = [start: number, end: number, replacement: string]

function rewriteImports(importer: ClientModule, imported: Set<string>): string {
  const splices: Splice[] = []
  for (const importStmt of parseImports(importer.text)) {
    const source = importStmt.source.value
    const isResolved = source.startsWith('/')
    const module =
      (isResolved && moduleMap[source.slice(1)]) || moduleMap[importStmt.text]
    if (!module) {
      continue
    }
    if (module.exports) {
      imported.add(module.id)
      if (!isResolved) {
        const resolvedUrl = getModuleUrl(module)
        moduleMap[resolvedUrl.slice(1)] = module
        // Modules with exports cannot be inlined, so we only
        // rewrite the import source string instead.
        splices.push([
          importStmt.source.start,
          importStmt.source.end,
          resolvedUrl,
        ])
      }
    } else {
      // Otherwise, the module is inlined.
      const text = module.imports
        ? rewriteImports(module, imported)
        : module.text

      splices.push([importStmt.start, importStmt.end, text])
    }
  }
  return applySplices(importer.text, splices)
}

function applySplices(text: string, splices: Splice[]) {
  let cursor = text.length
  splices.reverse().forEach((splice, i) => {
    const end = Math.min(splice[1], cursor)
    cursor = splice[0]
    text = text.slice(0, cursor) + splice[2] + text.slice(end)
  })
  return text
}

function getTagsForAssets(
  assets: Iterable<ClientModule>,
  headTags: HtmlTagDescriptor[]
) {
  for (const asset of assets) {
    const url = config.base + asset.id
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
