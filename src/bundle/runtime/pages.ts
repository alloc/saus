import path from 'path'
import { renderPageState } from '../../core/renderPageState'
import { renderStateModule } from '../../core/renderStateModule'
import { getPageFilename } from '../../utils/getPageFilename'
import { parseImports, serializeImports } from '../../utils/imports'
import { getPreloadTagsForModules } from '../../utils/modulePreload'
import { ParsedUrl } from '../../utils/url'
import { ClientModule, RenderedPage } from '../types'
import config from './config'
import { context } from './context'
import { applyHtmlProcessors, endent } from './core'
import { HtmlTagDescriptor, injectToBody, injectToHead } from './html'
import moduleMap from './modules'
import { getModuleUrl, isCSSRequest } from './utils'

const hydrateImport = `import { hydrate } from "saus/client"`

export async function renderPage(
  pageUrl: string | ParsedUrl
): Promise<RenderedPage | null> {
  if (!pageUrl.startsWith(config.base)) {
    return null
  }

  pageUrl = pageUrl.slice(config.base.length - 1)
  const page = await config.pageFactory?.render(pageUrl)
  if (!page) {
    return null
  }

  const filename = getPageFilename(pageUrl.toString())

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
    const updates: (() => void)[] = []
    for (const importStmt of parseImports(entryModule.text)) {
      const module = addModule(importStmt.text)
      if (module) {
        if (module.exports) {
          entryImports.add(module.id)
        } else if (module.imports) {
          module.imports.forEach(id => entryImports.add(id))
        }
        updates.push(() => {
          if (module.exports) {
            const { source } = importStmt
            entryModule.text =
              entryModule.text.slice(0, source.start) +
              getModuleUrl(module) +
              entryModule.text.slice(source.end)
          } else {
            // Inline the module since it has no exports.
            entryModule.text =
              entryModule.text.slice(0, importStmt.start) +
              module.text +
              entryModule.text.slice(importStmt.end)
          }
        })
      }
    }
    for (const update of updates.reverse()) {
      update()
    }
    entryModule.imports = Array.from(entryImports)
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

  if (entryModule) {
    modules.add(entryModule)
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
      hydrate(routeModule, pageState)
    `,
  })

  const html = injectToBody(injectToHead(page.html, headTags), bodyTags)
  return applyHtmlProcessors(
    html,
    { page, config, assets },
    context.htmlProcessors?.post || []
  ).then(html => ({
    id: filename,
    html,
    modules,
    assets,
  }))
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
