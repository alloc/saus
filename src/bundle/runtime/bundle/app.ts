import { createApp as create } from '@/app/createApp'
import type { App, RenderedPage } from '@/app/types'
import { defineEndpoint } from '@/endpoint'
import { loadDeployedEnv } from '@/runtime/deployedEnv'
import { setRequestMetadata } from '@/runtime/requestMetadata'
import { ssrClearCache, ssrImport } from '@/runtime/ssrModules'
import { prependBase } from '@/utils/base'
import { LazyPromise } from '@/utils/LazyPromise'
import config from './config'
import { context } from './context'
import { injectSausClient } from './injectSausClient'
import { providePageBundles } from './pageBundles'

// Allow `ssrImport("saus/client")` outside page rendering.
injectSausClient()

// Avoid loading the routes module more than once.
const routeSetup = new LazyPromise(resolve => {
  resolve(ssrImport(config.ssrEntryId))
})

export async function createApp(plugins: App.Plugin[] = []): Promise<App> {
  await loadDeployedEnv(config)
  await routeSetup
  return create(context, [
    isolatePages(context),
    providePageBundles,
    servePageRequests,
    ...plugins,
  ])
}

function isolatePages(context: App.Context): App.Plugin {
  const { config } = context
  const debugBase = config.debugBase || ''

  return ({ renderPage }) => ({
    renderPage(url, route, options = {}) {
      const callerSetup = options.setup
      return renderPage(url, route, {
        ...options,
        async setup(route, url) {
          await ssrClearCache()
          injectSausClient({
            BASE_URL: options.isDebug
              ? prependBase(debugBase, config.base)
              : config.base,
            isDebug: options.isDebug == true,
            prependBase(uri: string, base = config.base) {
              return prependBase(uri, base)
            },
          })
          if (callerSetup) {
            await callerSetup(route, url)
          }
        },
      })
    },
  })
}

const servePageRequests: App.Plugin = app => ({
  getEndpoints: (method, route) =>
    route.moduleId !== null &&
    method == 'GET' &&
    defineEndpoint({
      method: 'GET',
      contentTypes: ['text/html'],
      async run(req, headers) {
        const page = await app.renderPageBundle(req, route, {
          receivePage: (page: RenderedPage | null) =>
            page && setRequestMetadata(req, { page }),
        })
        if (page) {
          headers.content({
            type: 'text/html; charset=utf-8',
            length: Buffer.byteLength(page.html),
          })
          req.respondWith(200, {
            text: page.html,
          })
        }
      },
    }),
})
