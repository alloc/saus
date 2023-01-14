import { DevContext } from '@/context'
import { getEntryModules } from '@/getEntryModules'
import { clientDir, globalCachePath } from '@/paths'
import { cachePages } from '@runtime/app/cachePages'
import { createApp } from '@runtime/app/createApp'
import { renderErrorFallback } from '@runtime/app/errorFallback'
import { throttleRender } from '@runtime/app/throttleRender'
import { App, RenderPageOptions } from '@runtime/app/types'
import { RuntimeConfig } from '@runtime/config'
import { callPlugins } from '@utils/callPlugins'
import { throttle } from '@utils/throttle'
import { clearExports } from '@vm/moduleMap'
import createDebug from 'debug'
import os from 'os'
import path from 'path'
import { createHotReload } from './hotReload'

const debug = createDebug('saus:dev')

export async function createDevApp(
  context: DevContext,
  onError: (e: any) => void
): Promise<App> {
  const viteConfig = context.config
  const runtimeConfig: RuntimeConfig = {
    assetsDir: viteConfig.build.assetsDir,
    base: context.basePath,
    clientCacheId: '@fs' + globalCachePath,
    clientHelpersId: '@fs' + path.join(clientDir, 'helpers.mjs'),
    clientRuntimeId: '@id/saus/client',
    command: 'dev',
    defaultLayout: context.defaultLayout,
    defaultPath: context.defaultPath,
    htmlTimeout: viteConfig.saus.htmlTimeout,
    minify: false,
    mode: viteConfig.mode,
    publicDir: viteConfig.publicDir,
    ssrEntryId: '/@fs' + context.routesPath,
    stateModuleBase: viteConfig.saus.stateModuleBase!,
  }

  await callPlugins(context.plugins, 'onRuntimeConfig', runtimeConfig)

  const plugins = [
    createPageEndpoint(context, onError),
    isolatePages(context),
    cachePages(30, context.pageCache),
    throttleRender({
      onError: error => [null, error],
    }),
  ]

  return createApp(
    {
      ...context,
      viteTransformHtml(page) {
        return context.server.transformIndexHtml(
          page.path,
          page.html,
          undefined,
          { page }
        )
      },
      profile(type, event) {
        debug(type, event)
      },
      config: runtimeConfig,
      onError,
    },
    plugins
  )
}

const createPageEndpoint =
  (context: DevContext, onError: (e: any) => void): App.Plugin =>
  app => ({
    getEndpoints: (method, route) =>
      method == 'GET' &&
      route.moduleId !== null &&
      (async (req, headers) => {
        if (req.searchParams.has('html-proxy')) {
          return // handled by vite:html
        }
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

/**
 * Reload SSR modules before a page is rendered, so pages can't share
 * stateful modules between each other.
 */
function isolatePages(context: DevContext): App.Plugin {
  let entryPaths: string[]

  const reload: RenderPageOptions['setup'] = async (route, url) => {
    // TODO: reset this cache when routes module is changed?
    entryPaths ||= await getEntryModules(context)

    // Reset all modules used by every route or layout, because we can't
    // know which modules have side effects and are also used by the
    // route matched for the currently rendering page.
    for (const entryPath of entryPaths) {
      const entryModule = context.moduleMap.get(entryPath)
      if (entryModule) {
        for (const module of entryModule.package || [entryModule]) {
          clearExports(module)
        }
      }
    }

    // Reset the route clients, so they don't reference old exports.
    for (const client of Object.values(context.routeClients.clientsById)) {
      const clientModule = context.moduleMap.get(client!.id)
      if (clientModule) {
        clearExports(clientModule)
      }
    }

    const oldHotReload = context.hotReload
    context.hotReload = createHotReload(context, {
      schedule: throttle(queueMicrotask),
      ssr: true,
    })

    // This hook exists for URL-based module injection, which needs
    // to take place before the route and layouts are loaded.
    await Promise.all(context.pageSetupHooks.map(hook => hook(url)))

    await context.hotReload.promise
    context.hotReload = oldHotReload
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
