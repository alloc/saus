import endent from 'endent'
import { warn } from 'misty'
import * as vite from 'vite'
import { SausContext, Plugin, SausConfig } from '../core'
import { getPageFilename } from '../pages'
import { collectCss } from '../preload'

const clientPrefix = '/@saus/'

export function isClientUrl(id: string) {
  return id.startsWith(clientPrefix)
}

export function getClientUrl(id: string) {
  return clientPrefix + id
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
          filename = getPageFilename(
            path.replace(/\?.*$/, ''),
            context.basePath
          )
        }

        const page = context.pages[filename]
        const routeModuleId = page.routeModuleId
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
        if (client) {
          const clientUrl = getClientUrl(client.id)

          // Inject the <script> tag for generated client.
          tags.push({
            injectTo: 'body',
            tag: 'script',
            attrs: {
              type: 'module',
              src: clientUrl,
            },
          })

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
        tags.push({
          injectTo: 'body',
          tag: 'script',
          attrs: { id: 'initial-state', type: 'application/json' },
          children: JSON.stringify(state || {}),
        })

        const sausClientId =
          (configEnv.mode === 'production' ? '' : '/@id/') + 'saus/client'

        // Hydrate the page.
        tags.push({
          injectTo: 'body',
          tag: 'script',
          attrs: { type: 'module' },
          children: endent`
            import * as routeModule from "${
              context.basePath + routeModuleId.slice(1)
            }"
            import { hydrate } from "${sausClientId}"
            hydrate(routeModule, "${path}")
          `,
        })

        // Inject stylesheet tags for CSS modules.
        cssUrls.forEach(href =>
          tags.push({
            injectTo: 'head',
            tag: 'link',
            attrs: {
              href: context.basePath + href.slice(1),
              rel: 'stylesheet',
            },
          })
        )

        return tags
      },
    },
  }
}
