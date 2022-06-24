import { cachePages } from '@/app/cachePages'
import { createApp } from '@/app/createApp'
import { renderErrorFallback } from '@/app/errorFallback'
import { throttleRender } from '@/app/throttleRender'
import { App, RenderPageOptions } from '@/app/types'
import { DevContext } from '@/context'
import { extractClientFunctions, RuntimeConfig } from '@/core'
import { loadRenderers } from '@/loadRenderers'
import { globalCachePath } from '@/paths'
import { callPlugins } from '@/utils/callPlugins'
import { throttle } from '@/utils/throttle'
import { resolveEntryUrl } from '@/vite/resolveEntryUrl'
import { clearExports } from '@/vm/moduleMap'
import os from 'os'
import { createHotReload } from './hotReload'

export async function createDevApp(
  context: DevContext,
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
    ssrRoutesId: '/@fs' + context.routesPath,
    stateCacheId: '/@fs' + globalCachePath,
    stateModuleBase: viteConfig.saus.stateModuleBase!,
  }

  await callPlugins(context.plugins, 'onRuntimeConfig', runtimeConfig)

  const plugins = [
    createPageEndpoint(context, onError),
    isolatePages(context),
    cachePages(1, context.getCachedPage),
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
  (context: DevContext, onError: (e: any) => void): App.Plugin =>
  app => {
    const { server } = context
    return {
      getEndpoints: (method, route) =>
        method == 'GET' &&
        route.moduleId !== null &&
        (async (req, headers) => {
          let [page, error] = await app.renderPage(req, route, {
            // Skip default route if an extension is present.
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
              context.servedFiles[file.id] = file
            }
            page.html = await server.transformIndexHtml(req.path, page.html)
            if (!error && app.postProcessHtml) {
              page.html = await app.postProcessHtml(page)
            }
            headers.content({
              type: 'text/html; charset=utf-8',
              length: Buffer.byteLength(page.html),
            })
            req.respondWith(200, {
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
function isolatePages(context: DevContext): App.Plugin {
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

  const reload: RenderPageOptions['setup'] = async (
    pageContext,
    route,
    url
  ) => {
    // Reset all modules used by every route or renderer, because we can't know
    // which modules have side effects and are also used by the route matched
    // for the currently rendering page.
    for (const entryPath of entryPaths) {
      const entryModule = context.moduleMap[entryPath]
      if (entryModule) {
        for (const module of entryModule.package || [entryModule]) {
          clearExports(module)
        }
      }
    }

    const oldHotReload = context.hotReload
    context.hotReload = createHotReload(context, {
      schedule: throttle(queueMicrotask),
    })

    // This hook exists for URL-based module injection, which needs
    // to take place before the route and renderers are loaded.
    await Promise.all(context.pageSetupHooks.map(hook => hook(url)))

    await context.hotReload.promise
    context.hotReload = oldHotReload

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
            await reload(...args)
            if (callerSetup) {
              await callerSetup(...args)
            }
          },
        })
      },
    }
  }
}
