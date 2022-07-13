import { SourceMap } from '../node/sourceMap'
import { Plugin, vite } from '../vite'

export interface VirtualModule {
  id: string
  code: string | PromiseLike<string>
  moduleSideEffects?: boolean | 'no-treeshake'
  map?: SourceMap
}

export interface ModuleProvider extends Plugin {
  clientModules: ReadonlyMap<string, VirtualModule>
  serverModules: ReadonlyMap<string, VirtualModule>
  addModule(module: VirtualModule): VirtualModule
  addClientModule(module: VirtualModule): VirtualModule
  addServerModule(module: VirtualModule): VirtualModule
  clear(): void
}

export function createModuleProvider({
  clientModules = new Map(),
  serverModules = new Map(),
  watcher,
}: {
  clientModules?: Map<string, VirtualModule>
  serverModules?: Map<string, VirtualModule>
  watcher?: vite.FSWatcher
} = {}): ModuleProvider {
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
      wrapModuleCode(module, watcher)
      clientModules.set(module.id, module)
      serverModules.set(module.id, module)
      return module
    },
    addClientModule(module) {
      wrapModuleCode(module, watcher)
      clientModules.set(module.id, module)
      return module
    },
    addServerModule(module) {
      wrapModuleCode(module, watcher)
      serverModules.set(module.id, module)
      return module
    },
    clear() {
      clientModules.clear()
      serverModules.clear()
    },
  }
}

/**
 * Emit a watcher `change` event when `module.code` is updated.
 */
function wrapModuleCode(module: VirtualModule, watcher?: vite.FSWatcher) {
  let { code } = module
  Object.defineProperty(module, 'code', {
    get: () => code,
    set(value) {
      code = value
      watcher?.emit('change', module.id)
    },
    enumerable: true,
    configurable: true,
  })
}
