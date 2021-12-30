import path from 'path'
import { createPageFactory } from '../../pages'
import { parseImports } from '../../utils/imports'
import { ParsedUrl, parseUrl } from '../../utils/url'
import { ClientModule, RenderedPage } from '../types'
import config from './config'
import { context } from './context'
import { endent } from './core'
import functions from './functions'
import { HtmlTagDescriptor, injectToBody, injectToHead } from './html'
import moduleMap from './modules'
import { isCSSRequest } from './utils'

const pageFactory = createPageFactory(context, functions)
const hydrateImport = `import { hydrate } from "saus/client"`

const htmlExtension = '.html'
const indexHtmlSuffix = '/index.html'

export const getModuleUrl = (mod: ClientModule) =>
  config.base +
  (mod.id.endsWith(htmlExtension)
    ? mod.id.endsWith(indexHtmlSuffix)
      ? mod.id.slice(0, -indexHtmlSuffix.length)
      : mod.id.slice(0, -htmlExtension.length)
    : mod.id)

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

      const modules = new Set<ClientModule>()
      const addModule = (key: string) => {
        const module = moduleMap[key]
        if (!module) {
          return null
        }
        if (modules.has(module)) {
          return module
        }
        module.imports?.forEach(addModule)
        if (module.exports) {
          modules.add(module)
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

        // Modules are ordered depth-first, so the entry module comes last.
        modules.add(entryModule)
      }

      const headTags: HtmlTagDescriptor[] = []
      const bodyTags: HtmlTagDescriptor[] = []

      // The client state needed for page hydration.
      bodyTags.push({
        tag: 'script',
        attrs: { id: 'initial-state', type: 'application/json' },
        children: JSON.stringify(page.state || {}),
      })

      for (const module of modules) {
        const url = config.base + module.id
        if (isCSSRequest(url)) {
          headTags.push({
            tag: 'link',
            attrs: {
              rel: 'stylesheet',
              href: url,
            },
          })
        } else if (module !== entryModule) {
          headTags.push({
            tag: 'link',
            attrs: {
              rel: 'modulepreload',
              href: url,
            },
          })
        } else {
          bodyTags.push({
            tag: 'script',
            attrs: {
              type: 'module',
              src: url,
            },
          })
        }
      }

      // Add "state.json" modules after <script> and <link> tags
      // are generated from the `modules` array, since the page's
      // `state` object is inlined.
      if (typeof pageUrl == 'string') {
        pageUrl = parseUrl(pageUrl)
      }
      const pagePath = pageUrl.path.slice(config.base.length)
      modules.add({
        id: (pagePath ? pagePath + '/' : '') + 'state.json',
        text: JSON.stringify(page.state || {}),
      })

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

      let html = page.html
      html = injectToHead(html, headTags)
      html = injectToBody(html, bodyTags)

      resolve({
        html,
        modules: Array.from(modules),
      })
    })
  })
}
