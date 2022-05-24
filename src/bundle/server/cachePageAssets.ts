import type { App } from '../../app/types'
import type { FileCache } from './fileCache'

export const cachePageAssets =
  (cache: FileCache): App.Plugin =>
  ({ renderPageBundle }) => ({
    async renderPageBundle(url, route, options) {
      const page = await renderPageBundle(url, route, options)
      if (page) {
        cache.addModules(page.modules)
        cache.addAssets(page.assets)
      }
      return page
    },
  })
