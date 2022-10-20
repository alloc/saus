import { Plugin, vite } from '@/vite'
import { collectCss } from '@/vite/collectCss'
import { getPreloadTagsForModules } from '@/vite/modulePreload'
import { CommonServerProps } from '@runtime/app/types'
import { waitForCachePlugin } from '@runtime/cachePlugin'
import { RuntimeConfig } from '@runtime/config'
import { renderPageScript } from '@runtime/renderPageScript'
import { prependBase } from '@utils/base'
import { getPageFilename } from '@utils/getPageFilename'
import { DevContext } from '../context'
import { debug } from '../debug'
import { RouteClients } from '../routeClients'
import { renderRouteEntry } from '../routeEntries'

/**
 * This plugin is responsible for serving the generated client
 * modules in serve mode.
 */
export function routeClientsPlugin(): Plugin {
  let server: vite.ViteDevServer
  let context: DevContext
  let config: RuntimeConfig
  let routeClients: RouteClients

  return {
    name: 'saus:routeClients',
    apply: 'serve',
    configureServer(s) {
      server = s
    },
    saus(c) {
      const plugin = this
      context = c as DevContext
      return {
        receiveRoutes() {
          routeClients = c.routeClients
          plugin.resolveId = id => {
            const routeClient = routeClients.clientsByUrl[id]
            return routeClient?.id
          }
          plugin.load = async (id, opts) => {
            const client = routeClients.clientsById[id]
            if (client) {
              if (opts?.ssr) {
                return renderRouteEntry(client.renderer)
              }
              return client.promise
            }
          }
        },
        onRuntimeConfig(c) {
          config = c
        },
      }
    },
    transformIndexHtml: {
      enforce: 'pre',
      async transform(_, { filename, path: pagePath }) {
        const tags: vite.HtmlTagDescriptor[] = []

        if (!filename.endsWith('.html')) {
          filename = getPageFilename(pagePath.replace(/\?.*$/, ''))
        }

        const [page, error] = (await context.pageCache.get(pagePath)) || []

        if (error) return
        if (!page) {
          return debug('Page %s not found, skipping transform', pagePath)
        }

        const base = context.basePath
        const timestamp = (page.props as CommonServerProps)._ts || 0
        const pageStateId = base + filename + '.js?t=' + timestamp
        const sausClientId = base + '@id/saus/client'

        // TODO: preload transient dependencies?
        const modulesToPreload = [
          pageStateId,
          sausClientId,
          ...[...page.props._inlined, ...page.props._included].map(loaded =>
            prependBase(
              config.stateModuleBase + loaded.stateModule.key + '.js',
              base
            )
          ),
        ]

        const importedCss = new Set<vite.ModuleNode>()
        const findImportedCss = async (entry: string) => {
          await server.transformRequest(entry)
          await server.moduleGraph
            .getModuleByUrl(entry)
            .then(mod => mod && collectCss(mod, server, importedCss))
        }

        const routeModuleId = page.route.moduleId!
        await findImportedCss(routeModuleId)

        const routeClient = routeClients.addRoute(page.route)
        if (routeClient) {
          // Whether or not the layout is hydrated, we still
          // need to preload any imported stylesheets.
          await findImportedCss(routeClient.renderer.layoutModuleId)

          // We don't know if the page is hydrated until the
          // client promise is resolved with a non-empty string.
          if (await routeClient.promise) {
            tags.push({
              injectTo: 'body',
              tag: 'script',
              attrs: { type: 'module' },
              children: renderPageScript({
                pageStateId,
                sausClientId,
                routeClientId: prependBase(routeClient.url, base),
                catchHandler:
                  config.mode == 'development'
                    ? 'Saus.renderErrorPage'
                    : undefined,
              }),
            })

            modulesToPreload.push(
              prependBase(routeModuleId, base),
              prependBase(routeClient.url, base)
            )
          }
        }

        getPreloadTagsForModules(modulesToPreload, tags)

        // Inject stylesheet tags for CSS modules.
        const injectedStyles = await Promise.all(
          Array.from(
            importedCss,
            async (mod): Promise<vite.HtmlTagDescriptor> => ({
              injectTo: 'head',
              tag: 'style',
              attrs: {
                'data-id': mod.id,
              },
              children:
                '\n' +
                (await server.transformRequest(toDirectRequest(mod.url)))!
                  .code +
                '\n',
            })
          )
        )

        // Wait for pending cache updates that the page may depend on.
        await waitForCachePlugin()

        tags.push(...injectedStyles)
        return tags
      },
    },
  }
}

/** Add `?direct` so actual CSS is returned */
function toDirectRequest(url: string) {
  return url.replace(/(\?|$)/, q => '?direct' + (q ? '&' : ''))
}
