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
  addClientModule(module: VirtualModule): VirtualModule
  addServerModule(module: VirtualModule): VirtualModule
  clear(): void
}

const moduleDefaults: Partial<VirtualModule> = {
  moduleSideEffects: undefined,
  map: undefined,
}

export function createModuleProvider({
  clientModules = new Map(),
  serverModules = new Map(),
  watcher,
  root,
}: {
  clientModules?: Map<string, VirtualModule>
  serverModules?: Map<string, VirtualModule>
  watcher?: vite.FSWatcher
  root?: string
} = {}): ModuleProvider {
  const upsertModule = (
    module: VirtualModule,
    store: Map<string, VirtualModule>
  ) => {
    const existingModule = store.get(module.id)
    if (existingModule) {
      Object.assign(existingModule, moduleDefaults, module)
      return existingModule
    }
    store.set(module.id, module)
    wrapModuleCode(module, watcher)
    return module
  }
  return {
    name: 'saus:moduleProvider',
    enforce: 'pre',
    resolveId: (id, _importer, opts) => {
      const modules = opts?.ssr ? serverModules : clientModules
      if (modules.has(id)) {
        return id
      }
      // Dev aliases are converted to absolute paths.
      if (root && id[0] == '/') {
        if (modules.has(root + id)) {
          return id
        }
      }
      return null
    },
    async load(id, opts) {
      const module = (opts?.ssr ? serverModules : clientModules).get(id)
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
    addClientModule(module) {
      return upsertModule(module, clientModules)
    },
    addServerModule(module) {
      return upsertModule(module, serverModules)
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
