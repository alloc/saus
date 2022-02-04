import createDebug from 'debug'
import { clearCachedState } from '../runtime/clearCachedState'
import { getCachedState } from '../runtime/getCachedState'

const debug = createDebug('saus:cache')

const ssrPrefix = 'saus-ssr:'
const ssrModules: Record<string, ModuleGetter> = {}

/** Require a SSR module defined with `__d` */
export const __requireAsync = (id: string) => ssrModules[id]()
export { __requireAsync as ssrRequire }

type ModuleExports = Record<string, any>
type ModuleGetter = () => Promise<any>
type ModuleLoader = (
  exports: ModuleExports,
  module: { exports: ModuleExports }
) => Promise<void>

/** Define a SSR module with async loading capability */
export const __d = (id: string, loader: ModuleLoader) =>
  (ssrModules[id] = getCachedState.bind(
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
  clearCachedState(key => key.startsWith(ssrPrefix))
}
