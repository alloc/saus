import { expose, isWorkerRuntime } from 'threads/worker'
import {
  createLoader,
  loadContext,
  loadRoutes,
  ModuleLoader,
  RegexParam,
  RouteParams,
  SausContext,
  vite,
} from '../core'
import { setContext } from '../core/global'
import { createPageFactory, PageFactory } from '../pages'
import { renderPlugin } from '../plugins/render'
import { routesPlugin } from '../plugins/routes'

let loader: ModuleLoader
let context: SausContext
let setupPromise: Promise<PageFactory | void>

const isMainThread = !isWorkerRuntime()

export async function setup(inlineConfig?: vite.UserConfig) {
  context = await loadContext('build', inlineConfig, [
    renderPlugin,
    routesPlugin,
  ])

  loader = await createLoader(context, {
    cacheDir: false,
    server: { hmr: false, wss: false, watch: false },
  })

  // Don't wait for the page factory, so we can cancel
  // module loading early if necessary…
  setupPromise = (async () => {
    setContext(context)
    try {
      await loadRoutes(loader)
    } catch (e: any) {
      if (e.message !== 'Server is closed') {
        if (isMainThread) throw e
        return console.error(e)
      }
    } finally {
      setContext(null)
    }
    return createPageFactory(context)
  })()

  if (isMainThread) {
    // …except on the main thread, where cancellation is unsupported.
    return setupPromise.then(() => context)
  }
}

export async function close() {
  await loader.close()
}

export async function renderPage(routePath: string, params?: RouteParams) {
  const pageFactory = (await setupPromise)!
  if (routePath === 'default') {
    if (context.defaultRoute && context.defaultRenderer) {
      return pageFactory.renderUnknownPath('/404')
    }
  } else {
    const route = context.routes.find(route => route.path === routePath)!
    const pagePath = params ? RegexParam.inject(routePath, params) : routePath
    return pageFactory.renderMatchedPath(pagePath, params || {}, route)
  }
}

if (!isMainThread) {
  expose({ setup, close, renderPage })
}
