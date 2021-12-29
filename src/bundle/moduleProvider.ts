import { vite } from '../core/vite'
import createDebug from 'debug'

const debug = createDebug('saus:moduleProvider')

export interface VirtualModule {
  id: string
  code: string | PromiseLike<string>
  moduleSideEffects?: boolean | 'no-treeshake'
}

export interface ModuleProvider extends vite.Plugin {
  modules: ReadonlyMap<string, VirtualModule>
  addModule(module: VirtualModule): VirtualModule
}

export function createModuleProvider(): ModuleProvider {
  const modules = new Map<string, VirtualModule>()
  return {
    name: 'saus:moduleProvider',
    enforce: 'pre',
    resolveId: id => {
      const exists = modules.has(id)
      debug(`resolveId: ${id}${exists ? ` (exists)` : ``}`)
      return exists ? id : null
    },
    async load(id) {
      const module = modules.get(id)
      if (module) {
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
