import path from 'path'
import { createPageFactory, getPageFilename } from '../../pages'
import { parseImports } from '../../utils/imports'
import { ParsedUrl } from '../../utils/url'
import { ClientModule, RenderedPage } from '../types'
import config from './config'
import { context } from './context'
import { applyHtmlProcessors, endent } from './core'
import functions from './functions'
import { HtmlTagDescriptor, injectToBody, injectToHead } from './html'
import moduleMap from './modules'
import { isCSSRequest } from './utils'

export { writePages, printFiles } from '../../build/write'

const htmlExtension = '.html'
const indexHtmlSuffix = '/index.html'

export const getModuleUrl = (mod: ClientModule) =>
  config.base +
  (mod.id.endsWith(htmlExtension)
    ? mod.id.endsWith(indexHtmlSuffix)
      ? mod.id.slice(0, -indexHtmlSuffix.length)
      : mod.id.slice(0, -htmlExtension.length)
    : mod.id)

const pageFactory = createPageFactory(context, functions, config)
const hydrateImport = `import { hydrate } from "saus/client"`

export default function renderPage(
  pageUrl: string | ParsedUrl
): Promise<RenderedPage | null> {
  if (!pageUrl.startsWith(config.base)) {
    return Promise.resolve(null)
  }
  pageUrl = pageUrl.slice(config.base.length - 1)
  return new Promise((resolve, reject) => {
    pageFactory.resolvePage(pageUrl, (error, page) => {
      if (error) {
        return reject(error)
      }
      if (!page) {
        return resolve(null)
      }

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
        const updates: (() => void)[] = []
        for (const importStmt of parseImports(entryModule.text)) {
          const module = addModule(importStmt.text)
          if (module) {
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
      }

      const headTags: HtmlTagDescriptor[] = []
      const bodyTags: HtmlTagDescriptor[] = []

      getPreloadTagsForModules(modules, headTags)
      getTagsForAssets(assets, headTags)

      // Add "state.json" modules after "modulepreload" tags are
      // generated from the `modules` array, since the `page.state`
      // object is injected into the HTML as an inline script.
      const pageState = JSON.stringify(page.state || {})
      modules.add({
        id: joinUrls(pageUrl.toString(), 'state.json'),
        text: pageState,
      })
      bodyTags.push({
        tag: 'script',
        attrs: { id: 'initial-state', type: 'application/json' },
        children: pageState,
      })

      if (entryModule) {
        modules.add(entryModule)
        bodyTags.push({
          tag: 'script',
          attrs: {
            type: 'module',
            src: config.base + entryModule.id,
          },
        })
      }

      // Hydrate the page.
      bodyTags.push({
        tag: 'script',
        attrs: { type: 'module' },
        children: endent`
          import * as routeModule from "${getModuleUrl(routeModule)}"
          ${hydrateModule.text}
          hydrate(routeModule, "${pageUrl}")
        `,
      })

      const html = injectToBody(injectToHead(page.html, headTags), bodyTags)
      applyHtmlProcessors(
        html,
        { page, config, assets },
        context.htmlProcessors?.post || []
      ).then(html => {
        resolve({
          id: getPageFilename(pageUrl.toString()),
          html,
          modules,
          assets,
        })
      }, reject)
    })
  })
}

function joinUrls(url: string, suffix: string) {
  const hasTrailingSlash = url[url.length - 1] == '/'
  return (
    url +
    (suffix[0] == '/'
      ? hasTrailingSlash
        ? suffix.slice(1)
        : suffix
      : hasTrailingSlash
      ? suffix
      : '/' + suffix)
  )
}

function getPreloadTagsForModules(
  modules: Iterable<ClientModule>,
  headTags: HtmlTagDescriptor[]
) {
  for (const module of modules) {
    const url = config.base + module.id
    headTags.push({
      tag: 'link',
      attrs: {
        rel: 'modulepreload',
        href: url,
      },
    })
  }
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
