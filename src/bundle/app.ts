import { App, createApp as create } from '../app/createApp'
import type { AppContext, PageContext } from '../app/types'
import { context } from './context'
import config from './core/runtimeConfig'
import { defineClientEntry } from './defineClientEntry'
import { createPageFactory } from './pageFactory'
import { loadRenderers } from './render'
import { ssrClearCache, ssrImport } from './ssrModules'

// Allow `ssrImport("saus/client")` outside page rendering.
defineClientEntry()

export async function createApp(plugins: App.Plugin[] = []): Promise<App> {
  await ssrImport(config.ssrRoutesId)
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
      options.setup = async (pageContext: PageContext) => {
        ssrClearCache()
        defineClientEntry({
          BASE_URL: options.isDebug ? debugBase : '/',
        })
        context.renderers = []
        context.defaultRenderer = undefined
        context.beforeRenderHooks = []
        await loadRenderers(url.path)
        Object.assign(pageContext, context)
        if (callerSetup) {
          await callerSetup(pageContext, route, url)
        }
      }
      return renderPage(url, route, options)
    },
  })
}

function createPageEndpoint(context: AppContext): App.Plugin {
  return app => ({
    getEndpoints: (method, route) =>
      route.moduleId !== null &&
      method == 'GET' &&
      (async req => {
        const page = await app.renderPageBundle(req, route)
        if (page) {
          const headers = {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': '' + Buffer.byteLength(page.html),
          }
          req.respondWith(200, headers, {
            text: page.html,
          })
        }
      }),
  })
}
