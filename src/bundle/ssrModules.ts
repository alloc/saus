import createDebug from 'debug'
import { clearCachedState } from '../runtime/clearCachedState'
import { getCachedState } from '../runtime/getCachedState'

const debug = createDebug('saus:cache')

const ssrPrefix = 'saus-ssr:'
const ssrLoaderMap: Record<string, ModuleLoader<any>> = {}
const ssrPendingExports = new Map<string, any>()

/** Clear all loaded SSR modules */
export function ssrClearCache() {
  debug('Clearing the module cache')
  clearCachedState(key => key.startsWith(ssrPrefix))
}

const importerStack: string[] = []

export const getCurrentModule = (): string | undefined =>
  importerStack[importerStack.length - 1]

export function ssrImport<T = ModuleExports>(
  id: string,
  isRequire?: boolean
): Promise<T> {
  const loader = ssrLoaderMap[id]
  if (!loader) {
    throw Error(`Module not found: "${id}"`)
  }
  return getCachedState(ssrPrefix + id, async function ssrLoadModule() {
    const exports = {} as T & { __esModule?: boolean }
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

type Promisable<T> = T | PromiseLike<T>

type ModuleExports = Record<string, any>
type ModuleLoader<T = ModuleExports> = (
  exports: T,
  module?: { exports: T }
) => Promisable<void>

/** Define a SSR module with async loading capability */
export const __d = <T = ModuleExports>(id: string, loader: ModuleLoader<T>) =>
  (ssrLoaderMap[id] = loader)
