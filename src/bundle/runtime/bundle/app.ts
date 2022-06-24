import { createApp as create } from '@/app/createApp'
import type { App, AppContext, PageContext } from '@/app/types'
import { loadDeployedEnv } from '@/runtime/deployedEnv'
import { setRequestMetadata } from '@/runtime/requestMetadata'
import { ssrClearCache, ssrImport } from '@/runtime/ssrModules'
import { prependBase } from '@/utils/base'
import { LazyPromise } from '@/utils/LazyPromise'
import config from './config'
import { context } from './context'
import { defineClientEntry } from './defineClientEntry'
import { createPageFactory } from './pageFactory'
import { loadRenderers } from './render'

// Allow `ssrImport("saus/client")` outside page rendering.
defineClientEntry()

// Avoid loading the routes module more than once.
const routeSetup = new LazyPromise(resolve => {
  resolve(ssrImport(config.ssrRoutesId))
})

export async function createApp(plugins: App.Plugin[] = []): Promise<App> {
  await loadDeployedEnv(config)
  await routeSetup
  return create(context, [
    isolatePages(context),
    createPageFactory,
    createPageEndpoint(context),
    ...plugins,
  ])
}

function isolatePages(context: AppContext): App.Plugin {
  const { config } = context
  const debugBase = config.debugBase || ''

  return ({ renderPage }) => ({
    renderPage(url, route, options = {}) {
      const callerSetup = options.setup
      return renderPage(url, route, {
        ...options,
        async setup(pageContext: PageContext) {
          await ssrClearCache()
          defineClientEntry({
            BASE_URL: options.isDebug
              ? prependBase(debugBase, config.base)
              : config.base,
            isDebug: options.isDebug == true,
            prependBase(uri: string, base = config.base) {
              return prependBase(uri, base)
            },
          })
          context.renderers = []
          context.defaultRenderer = undefined
          context.beforeRenderHooks = []
          await loadRenderers(url.path)
          Object.assign(pageContext, context)
          if (callerSetup) {
            await callerSetup(pageContext, route, url)
          }
        },
      })
    },
  })
}

function createPageEndpoint(context: AppContext): App.Plugin {
  return app => ({
    getEndpoints: (method, route) =>
      route.moduleId !== null &&
      method == 'GET' &&
      (async (req, headers) => {
        const page = await app.renderPageBundle(req, route, {
          receivePage: page => page && setRequestMetadata(req, { page }),
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
      }),
  })
}
