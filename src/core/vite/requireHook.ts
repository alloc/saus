import Module from 'module'

const NodeModule: {
  _resolveFilename(id: string, parent: NodeModule, ...rest: any[]): void
} = Module as any

const viteEntry = require.resolve('vite')

const nodeResolve = NodeModule._resolveFilename
NodeModule._resolveFilename = (id, parent, ...rest) => {
  // Force plugins to use our version of Vite.
  if (id === 'vite' && !parent.loaded) {
    return viteEntry
  }
  return nodeResolve(id, parent, ...rest)
}
