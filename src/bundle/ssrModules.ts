import createDebug from 'debug'
import { clearCachedState } from '../runtime/clearCachedState'
import { getCachedState } from '../runtime/getCachedState'

const debug = createDebug('saus:cache')

const ssrPrefix = 'saus-ssr:'
const ssrLoaderMap: Record<string, ModuleLoader> = {}
const ssrPendingExports = new Map<string, any>()

/** Clear all loaded SSR modules */
export function ssrClearCache() {
  debug('Clearing the module cache')
  clearCachedState(key => key.startsWith(ssrPrefix))
}

const importerStack: string[] = []

export function ssrImport(id: string, isRequire?: boolean) {
  const loader = ssrLoaderMap[id]
  if (!loader) {
    throw Error(`Module not found: "${id}"`)
  }
  return getCachedState(ssrPrefix + id, async function ssrLoadModule() {
    const exports: ModuleExports = {}
    try {
      ssrPendingExports.set(id, exports)
      if (isRequire) {
        importerStack.push(id)
      }

      // CommonJS loader
      if (loader.length > 1) {
        const module = { exports }
        await loader(exports, module)
        return module.exports
      }

      // ESM loader
      await loader(exports)
      if (!exports.__esModule) {
        Object.defineProperty(exports, '__esModule', { value: true })
      }
      return exports
    } finally {
      ssrPendingExports.delete(id)
      if (isRequire) {
        importerStack.pop()
      }
    }
  })
}

/** Require a SSR module defined with `__d` */
export function __requireAsync(id: string) {
  if (importerStack.includes(id)) {
    return ssrPendingExports.get(id)
  }
  return ssrImport(id, true)
}

type ModuleExports = Record<string, any>
type ModuleLoader = (
  exports: ModuleExports,
  module?: { exports: ModuleExports }
) => Promise<void>

/** Define a SSR module with async loading capability */
export const __d = (id: string, loader: ModuleLoader) =>
  (ssrLoaderMap[id] = loader)
