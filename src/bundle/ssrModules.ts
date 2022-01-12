import { loadClientState } from '../client/state'

const ssrPrefix = 'saus-ssr:'
const ssrModules: Record<string, ModuleGetter> = {}

export const ssrRequire = (id: string) => ssrModules[id]()

type ModuleExports = Record<string, any>
type ModuleGetter = () => Promise<ModuleExports>
type ModuleLoader = (
  exports: ModuleExports,
  require: (id: string) => Promise<ModuleExports>
) => Promise<void>

/** Define a SSR module with async loading capability */
export const __d = (id: string, loader: ModuleLoader) =>
  (ssrModules[id] ||= () =>
    loadClientState(ssrPrefix + id, async () => {
      const exports: ModuleExports = {}
      Object.defineProperty(exports, '__esModule', { value: true })
      await loader(exports, ssrRequire)
      return exports
    }))
