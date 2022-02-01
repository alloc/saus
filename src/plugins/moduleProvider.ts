import createDebug from 'debug'
import { SourceMap } from '../utils/sourceMap'
import { vite } from '../core/vite'

const debug = createDebug('saus:moduleProvider')

export interface VirtualModule {
  id: string
  code: string | PromiseLike<string>
  moduleSideEffects?: boolean | 'no-treeshake'
  map?: SourceMap
}

export interface ModuleProvider {
  modules: ReadonlyMap<string, VirtualModule>
  addModule(module: VirtualModule): VirtualModule
}

export function createModuleProvider(): ModuleProvider & vite.Plugin {
  const modules = new Map<string, VirtualModule>()
  return {
    name: 'saus:moduleProvider',
    enforce: 'pre',
    resolveId: id => {
      const exists = modules.has(id)
      return exists ? id : null
    },
    async load(id) {
      const module = modules.get(id)
      if (module) {
        debug(`load: ${id}`)
        return { ...module, code: await module.code }
      }
    },
    get modules() {
      return new Map(modules)
    },
    addModule(module) {
      debug(`addModule: ${module.id}`)
      modules.set(module.id, module)
      return module
    },
  }
}
