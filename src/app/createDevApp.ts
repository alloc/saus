import os from 'os'
import { extractClientFunctions, RuntimeConfig, SausContext } from '../core'
import { loadRenderers } from '../core/loadRenderers'
import { globalCachePath } from '../core/paths'
import { callPlugins } from '../utils/callPlugins'
import { resolveEntryUrl } from '../utils/resolveEntryUrl'
import { clearExports } from '../vm/moduleMap'
import { cacheClientProps } from './cacheClientProps'
import { cachePages } from './cachePages'
import { App, createApp } from './createApp'
import { renderErrorFallback } from './errorFallback'
import { throttleRender } from './throttleRender'
import { RenderPageOptions } from './types'

export async function createDevApp(
  context: SausContext,
  onError: (e: any) => void
): Promise<App> {
  const functions = extractClientFunctions(context.renderPath)

  const viteConfig = context.config
  const runtimeConfig: RuntimeConfig = {
    assetsDir: viteConfig.build.assetsDir,
    base: context.basePath,
    command: 'dev',
    defaultPath: context.defaultPath,
    htmlTimeout: viteConfig.saus.htmlTimeout,
    minify: false,
    mode: viteConfig.mode,
    publicDir: viteConfig.publicDir,
    ssrRoutesId: '/@fs/' + context.routesPath,
    stateCacheId: '/@fs/' + globalCachePath,
  }

  await callPlugins(context.plugins, 'onRuntimeConfig', runtimeConfig)

  const plugins = [
    createPageEndpoint(context, onError),
    isolatePages(context),
    cachePages(1, context.getCachedPage),
    // By caching for 1 second, the client props will never go stale
    // while still allowing isomorphic routers and what-not to access
    // them without reloading them.
    cacheClientProps(1),
    throttleRender({
      onError: error => [null, error],
    }),
  ]

  return createApp(
    {
      ...context,
      config: runtimeConfig,
      helpersId: '@id/saus/src/client/helpers.ts',
      functions,
      onError,
    },
    plugins
  )
}

const createPageEndpoint =
  (context: SausContext, onError: (e: any) => void): App.Plugin =>
  app => {
    const server = context.server!
    return {
      getEndpoints: (method, route) =>
        method == 'GET' &&
        route.moduleId !== null &&
        (async req => {
          let [page, error] = await app.renderPage(req, route, {
            defaultRoute: !/\.[^./]+$/.test(req.path) && context.defaultRoute,
          })

          if (error) {
            // Since no catch route exists, we should render a page with the Vite client
            // attached so it can reload the page on the next update.
            let html: string

            for (const plugin of context.plugins) {
              if (!plugin.renderErrorReport) continue
              html = await plugin.renderErrorReport(req, error)
              break
            }

            html ||= renderErrorFallback(error, {
              homeDir: os.homedir(),
              root: context.root,
              ssr: true,
            })

            page = { html, files: [] } as any

            error.req = req
            onError(error)
          }

          if (page) {
            for (const file of page.files) {
              server.servedFiles[file.id] = file
            }
            page.html = await server.transformIndexHtml(req.path, page.html)
            if (!error && server.postProcessHtml) {
              page.html = await server.postProcessHtml(page)
            }
            const headers = {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Length': '' + Buffer.byteLength(page.html),
            }
            req.respondWith(200, headers, {
              text: page.html,
            })
          }
        }),
    }
  }

/**
 * Reload SSR modules before a page is rendered, so pages can't share
 * stateful modules between each other.
 */
function isolatePages(context: SausContext): App.Plugin {
  const routeModuleIds = new Set(
    context.routes.map(route => route.moduleId).filter(Boolean) as string[]
  )
  if (context.defaultRoute) {
    routeModuleIds.add(context.defaultRoute.moduleId!)
  }

  const entryPaths = Array.from(routeModuleIds, moduleId => {
    return resolveEntryUrl(moduleId, context.config)
  })
  entryPaths.push(context.renderPath)

  const server = context.server!
  const setup: RenderPageOptions['setup'] = async (pageContext, route) => {
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
  }

  return app => {
    const { renderPage } = app
    return {
      renderPage(url, route, options) {
        const callerSetup = options?.setup
        return renderPage(url, route, {
          ...options,
          async setup(...args) {
            await setup(...args)
            if (callerSetup) {
              await callerSetup(...args)
            }
          },
        })
      },
    }
  }
}
