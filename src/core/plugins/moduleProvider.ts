import { SourceMap } from '../node/sourceMap'
import { vite } from '../vite'

export interface VirtualModule {
  id: string
  code: string | PromiseLike<string>
  moduleSideEffects?: boolean | 'no-treeshake'
  map?: SourceMap
}

export interface ModuleProvider {
  clientModules: ReadonlyMap<string, VirtualModule>
  serverModules: ReadonlyMap<string, VirtualModule>
  addModule(module: VirtualModule): VirtualModule
  addClientModule(module: VirtualModule): VirtualModule
  addServerModule(module: VirtualModule): VirtualModule
  clear(): void
}

export function createModuleProvider(): ModuleProvider & vite.Plugin {
  const clientModules = new Map<string, VirtualModule>()
  const serverModules = new Map<string, VirtualModule>()
  return {
    name: 'saus:moduleProvider',
    enforce: 'pre',
    resolveId: (id, _importer, opts) => {
      const exists = (opts?.ssr ? serverModules : clientModules).has(id)
      return exists ? id : null
    },
    async load(id, ssr) {
      const module = (ssr ? serverModules : clientModules).get(id)
      if (module) {
        return { ...module, code: await module.code }
      }
    },
    get clientModules() {
      return new Map(clientModules)
    },
    get serverModules() {
      return new Map(serverModules)
    },
    addModule(module) {
      clientModules.set(module.id, module)
      serverModules.set(module.id, module)
      return module
    },
    addClientModule(module) {
      clientModules.set(module.id, module)
      return module
    },
    addServerModule(module) {
      serverModules.set(module.id, module)
      return module
    },
    clear() {
      clientModules.clear()
      serverModules.clear()
    },
  }
}
