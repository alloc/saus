import createDebug from 'debug'
import { loadedStateCache } from '../../core/cache'
import { loadState } from '../../core/loadStateModule'

const debug = createDebug('saus:cache')

const ssrPrefix = 'saus-ssr:'
const ssrModules: Record<string, ModuleGetter> = {}

export const ssrRequire = (id: string) => ssrModules[id]()

type ModuleExports = Record<string, any>
type ModuleGetter = () => Promise<any>
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

/** Runtime `import *` for compiled ESM. */
export function __importStar(exports: any) {
  if (exports && exports.__esModule && 'default' in exports) {
    exports = Object.assign({}, exports)
    delete exports.default
    return exports
  }
  return exports
}

/** Runtime `default` export unwrapping. */
export function __importDefault(exports: any) {
  return exports && exports.__esModule ? exports.default : exports
}

/** Clear all loaded SSR modules */
export function ssrClearCache() {
  debug('Clearing the module cache')
  loadedStateCache.forEach((_, key) => {
    if (key.startsWith(ssrPrefix)) {
      loadedStateCache.delete(key)
    }
  })
}
