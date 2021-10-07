import * as RegexParam from 'regexparam'
import * as vite from 'vite'
import { SausContext } from '../context'
import { PageFactory } from '../render'
import { RouteParams } from '../routes'
import { setup } from './setup'

let setupPromise: Promise<[PageFactory, SausContext]>

export function runSetup(inlineConfig?: vite.UserConfig) {
  setupPromise = setup(inlineConfig)
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
