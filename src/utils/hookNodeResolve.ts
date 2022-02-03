type NodeResolveFilename = (
  request: string,
  parent: NodeModule,
  isMain: boolean,
  options?: Record<string, any>
) => string

export function hookNodeResolve(
  getResolver: (resolveFilename: NodeResolveFilename) => NodeResolveFilename
) {
  const Module = require('module') as { _resolveFilename: NodeResolveFilename }
  const resolveFilename = Module._resolveFilename
  Module._resolveFilename = getResolver(resolveFilename)
  return () => {
    Module._resolveFilename = resolveFilename
  }
}
