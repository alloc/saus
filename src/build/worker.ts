import { RegexParam, RouteParams, SausContext, vite } from '../core'
import { PageFactory } from '../pages'
import { setup } from './setup'

let setupPromise: Promise<[PageFactory, SausContext]>

export async function runSetup(inlineConfig?: vite.UserConfig) {
  setupPromise = setup(inlineConfig)
  await setupPromise
}

export async function renderPage(routePath: string, params?: RouteParams) {
  const [pageFactory, context] = await setupPromise

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
