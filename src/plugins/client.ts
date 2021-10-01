import * as vite from 'vite'
import { Context, Client } from '../context'
import { collectCss } from '../preload'
import { Plugin } from '../vite'

const clientPrefix = '/@stite/'

export function clientPlugin(context: Context): Plugin {
  let server: vite.ViteDevServer
  let client: Client

  return {
    name: 'stite:client',
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
    resolveId: id => (id.startsWith(clientPrefix) ? id : null),
    load(id) {
      if (id.startsWith(clientPrefix)) {
        return client
      }
    },
    transformIndexHtml: async (_html, ctx) => {
      client = context.clients[ctx.path]

      // Transform the generated client.
      const clientUrl = clientPrefix + client.id
      await server.transformRequest(clientUrl)

      // Find CSS modules to preload.
      const clientModule = (await server.moduleGraph.getModuleByUrl(clientUrl))!
      const cssUrls = collectCss(clientModule)

      return [
        { injectTo: 'body', tag: 'script', attrs: { src: clientUrl } },
        ...Array.from(
          cssUrls,
          href =>
            ({
              injectTo: 'head',
              tag: 'link',
              attrs: { href },
            } as const)
        ),
      ]
    },
  }
}
