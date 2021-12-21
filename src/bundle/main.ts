import type { PageFactory, PageFactoryContext, RenderedPage } from '../pages'
import type { ParsedUrl } from '../utils/url'
import {
  createPageFactory,
  setRenderModule,
  setRoutesModule,
} from './runtime/core'
import functions from './runtime/functions'

export interface PageRenderer {
  (pageUrl: string | ParsedUrl): Promise<RenderedPage | null>
}

/**
 * SSR bundles import this function and wrap their "render module"
 * and "routes module" with it.
 */
export function main(install: () => Promise<void>): PageRenderer {
  let context: PageFactoryContext
  let pageFactory: PageFactory

  return async function (pageUrl) {
    if (!context) {
      context = {
        pages: {},
        states: {},
        logger: { warn: console.warn },
        beforeRenderHooks: [],
        renderers: [],
        routes: [],
      }

      setRenderModule(context)
      setRoutesModule(context)

      await install()
      pageFactory = createPageFactory(context, functions)
    }
    return new Promise((resolve, reject) => {
      pageFactory.resolvePage(pageUrl, (error, page) => {
        if (error) reject(error)
        else resolve(page || null)
      })
    })
  }
}
