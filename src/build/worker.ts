import { expose, isWorkerRuntime } from 'threads/worker'
import { RegexParam, RouteParams, vite } from '../core'
import { setup, SetupPromise } from './setup'

let setupPromise: SetupPromise

export async function runSetup(inlineConfig?: vite.UserConfig) {
  const [context] = await (setupPromise = setup(inlineConfig))
  if (!isWorkerRuntime()) {
    return context
  }
}

export async function tearDown() {
  const [, , loader] = await setupPromise
  await loader.close()
}

export async function renderPage(routePath: string, params?: RouteParams) {
  const [context, pageFactory] = await setupPromise

  if (routePath === 'default') {
    // Render the default page.
    if (context.defaultRoute && context.defaultRenderer) {
      return pageFactory.renderUnknownPath('/404')
    }
  } else {
    const route = context.routes.find(route => route.path === routePath)!
    const pagePath = params ? RegexParam.inject(routePath, params) : routePath
    return pageFactory.renderMatchedPath(pagePath, params || {}, route)
  }
}

if (isWorkerRuntime()) {
  expose({ runSetup, tearDown, renderPage })
}
