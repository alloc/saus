import { loadedStateCache } from '../client/cache'
import { loadState } from '../core/loadStateModule'

const ssrPrefix = 'saus-ssr:'
const ssrModules: Record<string, ModuleGetter> = {}

export const ssrRequire = (id: string) => ssrModules[id]()

type ModuleExports = Record<string, any>
type ModuleGetter = () => Promise<ModuleExports>
type ModuleLoader = (
  exports: ModuleExports,
  module: { exports: ModuleExports }
) => Promise<void>

/** Define a SSR module with async loading capability */
export const __d = (id: string, loader: ModuleLoader) =>
  (ssrModules[id] ||= () =>
    loadState(ssrPrefix + id, async () => {
      const exports: ModuleExports = {}
      const module = { exports }
      await loader(exports, module)
      return module.exports
    }))

/** Clear all loaded SSR modules */
export function ssrClearCache() {
  loadedStateCache.forEach((_, key) => {
    if (key.startsWith(ssrPrefix)) {
      loadedStateCache.delete(key)
    }
  })
}
