import { Module } from 'module'

export interface NodeModule extends NodeJS.Module {
  reload?: false
}

export function getNodeModule(id: string): NodeModule | undefined {
  return (Module as any)._cache[id]
}

export function unloadNodeModule(id: string) {
  delete (Module as any)._cache[id]
}

export function injectNodeModule(filename: string, exports: object) {
  const moduleCache = (Module as any)._cache as Record<string, NodeModule>
  let module = moduleCache[filename]
  if (module) {
    if (exports.constructor == Object) {
      const { __esModule, ...props } = Object.getOwnPropertyDescriptors(exports)
      Object.defineProperties(module.exports, props)
    } else {
      module.exports = exports
    }
  } else {
    module = new Module(filename)
    moduleCache[filename] = Object.assign(module, {
      filename,
      exports,
      loaded: true,
    })
  }
  module.reload = false
  return module
}
