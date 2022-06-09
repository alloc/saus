import endent from 'endent'
import { Plugin, RenderedPage, RuntimeConfig, SausConfig, vite } from '../core'
import { DevContext } from '../core/context'
import { debug } from '../core/debug'
import { CommonServerProps } from '../core/getModuleRenderer'
import { collectCss } from '../preload'
import { globalCache } from '../runtime/cache'
import { getPageFilename } from '../utils/getPageFilename'
import { getPreloadTagsForModules } from '../utils/modulePreload'
import { prependBase } from '../utils/prependBase'

const clientUrlPrefix = '/@saus/'
const clientIdPrefix = '\0' + clientUrlPrefix

export function isClientId(id: string) {
  return id.startsWith(clientIdPrefix)
}

export function getClientUrl(id: string, base: string) {
  return base + clientUrlPrefix.slice(1) + id
}

/**
 * This plugin is responsible for serving the generated client
 * modules in serve mode.
 */
export function serveClientEntries(
  { render: renderPath }: SausConfig,
  configEnv: vite.ConfigEnv
): Plugin {
  let server: vite.ViteDevServer
  let context: DevContext
  let config: RuntimeConfig

  return {
    name: 'saus:client',
    apply: 'serve',
    configureServer(s) {
      server = s
    },
    saus(c) {
      context = c as DevContext
      config = context.app.config
    },
    resolveId(id, importer) {
      if (id.startsWith(clientUrlPrefix)) {
        return '\0' + id
      }
      if (importer && isClientId(importer)) {
        return this.resolve(id, renderPath, {
          skipSelf: true,
        })
      }
    },
    load(id) {
      if (isClientId(id)) {
        const cacheKey = id.replace(clientIdPrefix, '')
        const [client] = globalCache.loaded[cacheKey]
        if (client) {
          return client.code
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

        type CachedPage = [RenderedPage, any]

        const pagePath = '/' + filename.replace(/(index)?\.html$/, '')
        const [page, error] =
          (await context.getCachedPage<CachedPage>(pagePath)) || []

        if (error) return
        if (!page) {
          return debug('Page %s not found, skipping transform', pagePath)
        }

        const base = context.basePath
        const timestamp = (page.props as CommonServerProps)._ts || 0
        const pageStateUrl = base + filename + '.js?t=' + timestamp
        const routeModuleId = page.routeModuleId
        const routeModuleUrl = base + routeModuleId.slice(1)
        const sausClientUrl = base + '@id/saus/client'

        // TODO: preload transient dependencies?
        const modulesToPreload = [
          pageStateUrl,
          routeModuleUrl,
          sausClientUrl,
          ...page.stateModules.map(id =>
            prependBase(config.stateModuleBase + id + '.js', base)
          ),
        ]

        const importedCss = new Set<vite.ModuleNode>()
        if (server) {
          // Cache the main route module.
          await server.transformRequest(routeModuleId)

          // Find CSS modules used by the route module.
          await server.moduleGraph
            .getModuleByUrl(routeModuleId)
            .then(mod => mod && collectCss(mod, server, importedCss))
        }

        const client = page.client
        const clientUrl = client ? getClientUrl(client.id, base) : ''
        if (client) {
          modulesToPreload.push(clientUrl)

          if (server) {
            const clientVirtualId = clientUrlPrefix + client.id

            // Cache the generated client.
            await server.transformRequest(clientVirtualId)

            // Find CSS modules used by the generated client.
            await server.moduleGraph
              .getModuleByUrl(clientVirtualId)
              .then(mod => mod && collectCss(mod, server, importedCss))
          }
        }

        getPreloadTagsForModules(modulesToPreload, tags)

        let sausClientImports = ['hydrate']
        let hydrateCall = `hydrate(pageState, routeModule, "${routeModuleUrl}")`

        if (context.config.mode == 'development') {
          sausClientImports.push('renderErrorPage')
          hydrateCall += `.catch(renderErrorPage)`
        }

        // Hydrate the page.
        tags.push({
          injectTo: 'body',
          tag: 'script',
          attrs: { type: 'module' },
          children: endent`
            import pageState from "${pageStateUrl}"
            import { ${sausClientImports.join(', ')} } from "${sausClientUrl}"

            Promise.all([
              import("${routeModuleUrl}"),${
            clientUrl && `\nimport("${clientUrl}"),`
          }
            ]).then(([routeModule]) =>
              ${hydrateCall}
            )
          `,
        })

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
