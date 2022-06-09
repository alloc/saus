import { Module } from 'module'

export function getNodeModule(id: string): NodeModule | undefined {
  return (Module as any)._cache[id]
}

export function invalidateNodeModule(id: string) {
  delete (Module as any)._cache[id]
}

export function injectNodeModule(filename: string, exports: object) {
  const moduleCache = (Module as any)._cache as Record<string, NodeModule>
  let module = moduleCache[filename]
  if (module) {
    if (exports.constructor == Object) {
      Object.defineProperties(
        module.exports,
        Object.getOwnPropertyDescriptors(exports)
      )
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
  return module
}
