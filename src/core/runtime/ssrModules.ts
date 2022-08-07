import { createCache } from '@/runtime/cache/create'
import createDebug from 'debug'
import { noop } from '../utils/noop'

const debug = createDebug('saus:ssr')

const ssrModules = createCache()
const ssrLoaderMap: Record<string, ModuleLoader<any>> = {}
const ssrPendingExports = new Map<string, ModuleExports>()

/** Clear all loaded SSR modules */
export async function ssrClearCache() {
  while (mainModule) {
    await mainModule
  }
  debug('Clearing the module cache')
  ssrModules.clear()
}

let mainModule: Promise<void> | null = null
let importerStack: string[] = []

export const getCurrentModule = (): string | undefined =>
  importerStack[importerStack.length - 1]

function importModule<T = ModuleExports>(
  id: string,
  isMain?: boolean
): Promise<T> {
  const loader = ssrLoaderMap[id]
  if (!loader) {
    throw Error(`Module not found: "${id}"`)
  }
  return ssrModules.load(id, async function ssrLoadModule() {
    // To avoid stepping on the toes of other top-level imports,
    // we need to avoid loading them in parallel.
    while (isMain && mainModule) {
      await mainModule
    }
    const exports = {} as T & { __esModule?: boolean }
    try {
      importerStack.push(id)
      ssrPendingExports.set(id, exports)

      const isCommonJS = loader.length > 1
      const cjsModule = isCommonJS ? { exports } : null!
      const loading = isCommonJS ? loader(exports, cjsModule) : loader(exports)
      if (isMain) {
        const start = Date.now()
        // Postpone other top-level imports.
        mainModule = Promise.resolve(loading)
          .catch(noop)
          .then(() => {
            mainModule = null

            const elapsed = ((Date.now() - start) / 1e3).toFixed(3)
            debug('Loaded "%s" in %ss', id, elapsed)
          })
      }

      // Wait for the module and its static dependencies.
      await loading

      // Return the module's exports.
      if (isCommonJS) {
        return cjsModule.exports
      }
      if (!exports.__esModule) {
        Object.defineProperty(exports, '__esModule', { value: true })
      }
      return exports
    } finally {
      ssrPendingExports.delete(id)
      importerStack.pop()
    }
  })
}

/**
 * Safely import a module without interrupting other modules that
 * may be in the process of loading.
 */
export const ssrImport = <T = ModuleExports>(id: string): Promise<T> =>
  importModule(id, true)

/**
 * This should only be used for *static* imports within a module
 * loader defined with the `__d` function.
 */
export function __requireAsync(id: string) {
  const pendingExports = ssrPendingExports.get(id)
  if (pendingExports) {
    return Promise.resolve(pendingExports)
  }
  return importModule(id)
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
