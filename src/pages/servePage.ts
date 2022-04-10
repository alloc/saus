import { matchRoute, RuntimeConfig, SausContext } from '../core'
import { applyHtmlProcessors } from '../core/html'
import { loadRenderers } from '../core/loadRenderers'
import { resolveEntryUrl } from '../utils/resolveEntryUrl'
import { clearExports } from '../vm/moduleMap'
import { renderErrorFallback } from './errorFallback'
import { RenderPageOptions } from './types'

export type ServePageFn = (url: string) => Promise<ServedPage | undefined>
export type ServedPage = {
  error?: any
  body?: any
  headers?: [string, string | number][]
}

/**
 * Create the `servePage` function used in development, which is exposed
 * on the Vite dev server as its `servePage` method and used by the
 * `saus:serve` plugin as well.
 */
export function createServePageFn(
  context: SausContext,
  runtimeConfig: RuntimeConfig,
  onError: (url: string, e: any) => void
): ServePageFn {
  const { config } = context
  const server = context.server!

  const routeModuleIds = new Set(context.routes.map(route => route.moduleId))
  if (context.defaultRoute) {
    routeModuleIds.add(context.defaultRoute.moduleId)
  }

  const entryPaths = Array.from(routeModuleIds, moduleId => {
    return resolveEntryUrl(moduleId, config)
  })
  entryPaths.push(context.renderPath)

  const renderOpts: RenderPageOptions = {
    async setup(pageContext, pageUrl) {
      const route =
        context.routes.find(route => matchRoute(pageUrl.path, route)) ||
        context.defaultRoute
      if (!route) return

      // Reset all modules used by every route or renderer, because we can't know
      // which modules have side effects and are also used by the route matched
      // for the currently rendering page.
      for (const entryPath of entryPaths) {
        const entryModule = server.moduleMap[entryPath]
        if (entryModule) {
          for (const module of entryModule.package || [entryModule]) {
            clearExports(module)
          }
        }
      }

      // Load the route module and its dependencies now, since the
      // setup function is guaranteed to run serially, which lets us
      // ensure no local modules are shared between page renders.
      await route.load()

      context.renderers = []
      context.defaultRenderer = undefined
      context.beforeRenderHooks = []
      await loadRenderers(context)
      Object.assign(pageContext, context)
    },
  }

  return async function servePage(url) {
    try {
      let [page, error] = await server.renderPage(url, renderOpts)
      if (!page && !error && !/\.[^./]+$/.test(url)) {
        ;[page, error] = await server.renderPage(
          context.defaultPath,
          renderOpts
        )
      }
      if (error) {
        // Since no catch route exists, we should render a page with the Vite client
        // attached so it can reload the page on the next update.
        let html: string

        for (const plugin of context.plugins) {
          if (!plugin.renderErrorReport) continue
          html = await plugin.renderErrorReport(url, error)
          break
        }

        html ||= renderErrorFallback(error, context)
        page = { html, files: [] } as any

        onError(url, error)
      }
      if (page) {
        if (!Array.isArray(page.files)) {
          debugger
        }
        for (const file of page.files) {
          server.servedFiles[file.id] = file
        }
        let html = await server.transformIndexHtml(url, page.html)
        if (!error && context.htmlProcessors?.post.length) {
          html = await applyHtmlProcessors(
            html,
            context.htmlProcessors.post,
            { page, config: runtimeConfig },
            runtimeConfig.htmlTimeout
          )
        }
        return {
          body: html,
          headers: [
            ['Content-Type', 'text/html; charset=utf-8'],
            ['Content-Length', Buffer.byteLength(html)],
          ],
        }
      }
    } catch (error) {
      return { error }
    }
  }
}
