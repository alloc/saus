import type { App } from '../../app/createApp'
import type { FileCache } from './fileCache'

export const cachePageAssets =
  (cache: FileCache): App.Plugin =>
  app => ({
    async renderPageBundle(url, route, options) {
      const page = await app.renderPageBundle(url, route, options)
      if (page) {
        cache.addModules(page.modules)
        cache.addAssets(page.assets)
      }
      return page
    },
  })
