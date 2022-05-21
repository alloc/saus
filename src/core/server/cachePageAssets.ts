import { BundledApp } from '../../bundle/types'
import { FileCache } from './fileCache'

export const cachePageAssets =
  (cache: FileCache): BundledApp.Plugin =>
  app => {
    const { renderPage } = app
    return {
      async renderPage(url, route, options) {
        const page = await renderPage(url, route, options)
        if (page) {
          cache.addModules(page.modules)
          cache.addAssets(page.assets)
        }
        return page
      },
    }
  }
