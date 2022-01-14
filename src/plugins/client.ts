import endent from 'endent'
import { warn } from 'misty'
import * as vite from 'vite'
import { SausContext, Plugin, SausConfig } from '../core'
import { collectCss } from '../preload'
import { getPageFilename } from '../utils/getPageFilename'
import { serializeImports } from '../utils/imports'
import { getPreloadTagsForModules } from '../utils/modulePreload'

const clientPrefix = '/@saus/'

export function isClientUrl(id: string) {
  return id.startsWith(clientPrefix)
}

export function getClientUrl(id: string, base: string) {
  return base + clientPrefix.slice(1) + id
}

/**
 * This plugin is responsible for serving the generated client
 * modules in serve mode.
 */
export function clientPlugin(
  { render: renderPath }: SausConfig,
  configEnv: vite.ConfigEnv
): Plugin {
  let server: vite.ViteDevServer
  let context: SausContext

  return {
    name: 'saus:client',
    apply: 'serve',
    configureServer(s) {
      server = s
    },
    saus: {
      onContext(c) {
        context = c
      },
    },
    resolveId(id, importer) {
      if (isClientUrl(id)) {
        return id
      }
      if (importer && isClientUrl(importer)) {
        return this.resolve(id, renderPath, {
          skipSelf: true,
        })
      }
    },
    load(id) {
      if (isClientUrl(id)) {
        id = id.replace(clientPrefix, '')

        // Find a page that uses this client.
        const page = Object.values(context.pages).find(
          page => id === page.client?.id
        )
        if (page) {
          return page.client!.code
        }
      }
    },
    transformIndexHtml: {
      enforce: 'pre',
      async transform(_, { filename, path }) {
        const tags: vite.HtmlTagDescriptor[] = []

        if (!filename.endsWith('.html')) {
          filename = getPageFilename(path.replace(/\?.*$/, ''))
        }

        const page = context.pages[filename]
        const routeModuleId = page.routeModuleId

        const base = context.basePath
        const pageStateUrl = base + filename + '.js'
        const routeModuleUrl = base + routeModuleId.slice(1)
        const sausClientUrl = base + '@id/saus/client'

        // TODO: preload transient dependencies?
        const modulesToPreload = [
          pageStateUrl,
          routeModuleUrl,
          sausClientUrl,
          ...page.stateModules.map(
            stateModuleId => base + 'state/' + stateModuleId + '.js'
          ),
        ]

        const cssUrls = new Set<string>()
        if (server) {
          // Cache the main route module.
          await server.transformRequest(routeModuleId)

          // Find CSS modules used by the route module.
          await server.moduleGraph
            .getModuleByUrl(routeModuleId)
            .then(mod => mod && collectCss(mod, cssUrls))
        }

        const client = page.client
        const clientUrl = client ? getClientUrl(client.id, base) : ''
        if (client) {
          modulesToPreload.push(clientUrl)

          if (server) {
            // Cache the generated client.
            await server.transformRequest(clientUrl)

            // Find CSS modules used by the generated client.
            await server.moduleGraph
              .getModuleByUrl(clientUrl)
              .then(mod => mod && collectCss(mod, cssUrls))
          }
        }

        // Even though we could embed this JSON string into the hydration
        // script, making the HTML parser aware of its JSON format allows
        // it to be parsed earlier than it otherwise would be.
        const state = context.loadedStateCache.get(page.path)
        if (!state) {
          warn(`Missing client state for page: "${page.path}"`)
        }

        getPreloadTagsForModules(modulesToPreload, tags)

        // Hydrate the page.
        tags.push({
          injectTo: 'body',
          tag: 'script',
          attrs: { type: 'module' },
          children: endent`
            import pageState from "${pageStateUrl}"
            import * as routeModule from "${routeModuleUrl}"
            ${serializeImports(clientUrl ? [clientUrl] : [])}
            import { hydrate } from "${sausClientUrl}"
            hydrate(routeModule, pageState)
          `,
        })

        // Inject stylesheet tags for CSS modules.
        cssUrls.forEach(href =>
          tags.push({
            injectTo: 'head',
            tag: 'link',
            attrs: {
              rel: 'stylesheet',
              href: base + href.slice(1),
            },
          })
        )

        return tags
      },
    },
  }
}
