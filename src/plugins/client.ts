import endent from 'endent'
import * as vite from 'vite'
import { SausContext, Plugin, SausConfig, RenderedPage } from '../core'
import { debug } from '../core/debug'
import { collectCss } from '../preload'
import { loadedStateCache } from '../runtime/cache'
import { getPageFilename } from '../utils/getPageFilename'
import { serializeImports } from '../utils/imports'
import { getPreloadTagsForModules } from '../utils/modulePreload'

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
        const client = loadedStateCache.get(id.replace(clientIdPrefix, ''))
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

        const pagePath = '/' + filename.replace(/(index)?\.html$/, '')
        const page = await context.getCachedPage<RenderedPage>(pagePath)
        if (!page) {
          return debug('Page %s not found, skipping transform', pagePath)
        }

        const base = context.basePath
        const pageStateUrl = base + filename + '.js?t=' + page.state._ts
        const routeModuleId = page.routeModuleId
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
            // Cache the generated client.
            await server.transformRequest(clientUrl)

            // Find CSS modules used by the generated client.
            await server.moduleGraph
              .getModuleByUrl(clientUrl)
              .then(mod => mod && collectCss(mod, server, importedCss))
          }
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
            hydrate(pageState, routeModule, "${routeModuleUrl}")
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
