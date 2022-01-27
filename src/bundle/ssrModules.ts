import createDebug from 'debug'
import { loadedStateCache } from '../core/cache'
import { loadState } from '../core/loadStateModule'

const debug = createDebug('saus:cache')

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
  (ssrModules[id] = loadState.bind(
    null,
    ssrPrefix + id,
    async function ssrLoadModule() {
      const exports: ModuleExports = {}
      const module = { exports }
      await loader(exports, module)
      return module.exports
    }
  ))

/** Clear all loaded SSR modules */
export function ssrClearCache() {
  debug('Clearing the module cache')
  loadedStateCache.forEach((_, key) => {
    if (key.startsWith(ssrPrefix)) {
      loadedStateCache.delete(key)
    }
  })
}
