import path from 'path'
import { parseImports } from '../../utils/imports'
import type { ParsedUrl } from '../../utils/url'
import { ClientModule, RenderedPage } from '../types'
import config from './config'
import { context } from './context'
import { createPageFactory, endent } from './core'
import functions from './functions'
import { HtmlTagDescriptor, injectToBody, injectToHead } from './html'
import moduleMap from './modules'
import { isCSSRequest } from './utils'

const pageFactory = createPageFactory(context, functions)
const hydrateImport = `import { hydrate } from "saus/client"`

export default function renderPage(
  pageUrl: string | ParsedUrl
): Promise<RenderedPage | null> {
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
        url: config.base + entryId,
        file: path.join(config.cacheDir, entryId),
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
                  module.url +
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
        if (isCSSRequest(module.url)) {
          headTags.push({
            tag: 'link',
            attrs: {
              rel: 'stylesheet',
              href: module.url,
            },
          })
        } else if (module !== entryModule) {
          headTags.push({
            tag: 'link',
            attrs: {
              rel: 'modulepreload',
              href: module.url,
            },
          })
        } else {
          bodyTags.push({
            tag: 'script',
            attrs: {
              type: 'module',
              src: module.url,
            },
          })
        }
      }

      // Hydrate the page.
      bodyTags.push({
        tag: 'script',
        attrs: { type: 'module' },
        children: endent`
            import * as routeModule from "${routeModule.url}"
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
