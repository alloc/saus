import path from 'path'
import * as vite from 'vite'
import { Context, Client } from '../context'
import { collectCss } from '../preload'
import { Plugin } from '../vite'

const clientPrefix = '/@saus/'

export function clientPlugin(context: Context): Plugin {
  let server: vite.ViteDevServer
  let client: Client

  return {
    name: 'saus:client',
    // config: () => ({
    //   build: {
    //     rollupOptions: {
    //       input: clientUrl,
    //     },
    //   },
    // }),
    configureServer(s) {
      server = s
    },
    async contextUpdate() {
      const { moduleGraph } = server
      moduleGraph.urlToModuleMap.forEach((mod, url) => {
        url.startsWith(clientPrefix) && moduleGraph.invalidateModule(mod)
      })
    },
    resolveId(id, importer) {
      if (id.startsWith(clientPrefix)) {
        return id
      }
      if (importer?.startsWith(clientPrefix)) {
        return this.resolve(id, context.renderPath, {
          skipSelf: true,
        })
      }
    },
    load(id) {
      if (id.startsWith(clientPrefix)) {
        return client
      }
    },
    transformIndexHtml: async (_html, ctx) => {
      client = context.clients[ctx.path]

      // Cache the generated client.
      const clientUrl = clientPrefix + client.id
      await server.transformRequest(clientUrl)

      // Cache the main route module.
      const { routeModuleId } = client.state
      await server.transformRequest(routeModuleId)

      // Find CSS modules to preload.
      const { moduleGraph } = server
      const clientModule = (await moduleGraph.getModuleByUrl(clientUrl))!
      const routeModule = (await moduleGraph.getModuleByUrl(routeModuleId))!
      const cssUrls = collectCss(clientModule)
      collectCss(routeModule, cssUrls)

      // TODO: preload generated client in production
      const isProduction = context.configEnv.mode === 'production'

      return [
        {
          injectTo: 'body',
          tag: 'script',
          attrs: { id: 'client_state', type: 'application/json' },
          children: JSON.stringify(client.state),
        },
        {
          injectTo: 'body',
          tag: 'script',
          attrs: {
            type: 'module',
            src: clientUrl,
          },
        },
        ...Array.from(
          cssUrls,
          href =>
            ({
              injectTo: 'head',
              tag: 'link',
              attrs: { href, rel: 'stylesheet' },
            } as const)
        ),
      ]
    },
  }
}
