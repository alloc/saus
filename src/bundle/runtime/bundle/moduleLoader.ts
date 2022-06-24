import fs from 'fs'
import path from 'path'
import config from './config'
import inlinedModules from './inlinedModules'

type Promisable<T> = T | PromiseLike<T>

export interface ModuleLoader {
  loadModule(id: string, isDebug?: boolean): Promisable<string>
}

export namespace ModuleLoader {
  export interface Factory {
    (): ModuleLoader
  }
}

const debugBase = config.debugBase?.slice(1)

export default (): ModuleLoader => ({
  loadModule(id, isDebug) {
    const module = inlinedModules[id]
    if (module) {
      const text = isDebug ? module.debugText : module.text
      if (text !== undefined) {
        return text
      }
    }
    const file = isDebug ? path.join(debugBase!, id) : id
    return fs.readFileSync(file, 'utf8')
  },
})
