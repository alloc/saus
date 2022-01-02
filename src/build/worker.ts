import { expose, isWorkerRuntime } from 'threads/worker'
import { createLoader, loadContext, ModuleLoader } from '../core/context'
import {
  extractClientFunctions,
  mergeHtmlProcessors,
  RegexParam,
  RouteParams,
  SausContext,
  vite,
} from '../core'
import { getRuntimeConfig } from '../core/config'
import { setRenderModule, setRoutesModule } from '../core/global'
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
    setRenderModule(context)
    setRoutesModule(context)
    try {
      await loader.ssrLoadModule(
        [context.routesPath, context.renderPath].map(file =>
          file.replace(context.root, '')
        )
      )
    } catch (e: any) {
      if (e.message !== 'Server is closed') {
        if (isMainThread) throw e
        return console.error(e)
      }
    } finally {
      setRenderModule(null)
      setRoutesModule(null)
    }

    const config = getRuntimeConfig('build', context)
    context.runtimeHooks.forEach(onSetup => {
      onSetup(config)
    })
    if (context.htmlProcessors) {
      context.processHtml = mergeHtmlProcessors(
        context.htmlProcessors,
        page => ({ page, config })
      )
    }

    return createPageFactory(
      context,
      extractClientFunctions(context.renderPath)
    )
  })()

  if (isMainThread) {
    // …except on the main thread, where cancellation is unsupported.
    return setupPromise.then(() => context)
  }
}

export async function close() {
  await loader.close()
}

export async function getState(routePath: string, params?: RouteParams) {
  const pageFactory = (await setupPromise)!
  const pagePath = params ? RegexParam.inject(routePath, params) : routePath
  return pageFactory.getState(pagePath)
}

export async function renderPage(routePath: string, params?: RouteParams) {
  const pageFactory = (await setupPromise)!
  try {
    if (routePath === context.defaultPath) {
      if (context.defaultRoute && context.defaultRenderer) {
        return pageFactory.renderUnknownPage(routePath)
      }
    } else {
      const route = context.routes.find(route => route.path === routePath)!
      const pagePath = params ? RegexParam.inject(routePath, params) : routePath
      return pageFactory.renderRoute(pagePath, params || {}, route)
    }
  } catch (error) {
    loader.ssrRewriteStacktrace(error, context.config.filterStack)
    throw error
  }
}

if (!isMainThread) {
  expose({ setup, close, renderPage })
}
