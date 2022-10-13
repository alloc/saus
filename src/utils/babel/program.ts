import { NodePath, types as t } from '@babel/core'
import { transformSync } from './transform'

export function getBabelProgram(source: string, filename: string) {
  let program: NodePath<t.Program> | undefined
  const visitor: babel.Visitor = {
    Program: path => {
      program = path
      path.stop()
    },
  }

  // Use the AST for traversal, but not code generation.
  transformSync(source, filename, {
    plugins: [{ visitor }],
    sourceMaps: false,
    sourceType: 'module',
    code: false,
  })

  return program!
}
