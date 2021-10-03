import * as vite from 'vite'
import md5Hex from 'md5-hex'
import { SausContext } from '../context'
import { babel, t, NodePath } from '../babel'

export function renderMetaPlugin({ renderPath }: SausContext): vite.Plugin {
  return {
    name: 'saus:render-meta',
    enforce: 'pre',
    transform(code, id) {
      if (id === renderPath) {
        return babel.transformSync(code, {
          sourceMaps: true,
          filename: id,
          plugins: [
            ['@babel/syntax-typescript', { isTSX: /\.[tj]sx$/.test(id) }],
            { visitor: { Program: injectRenderMetadata } },
          ],
        }) as vite.TransformResult
      }
    },
  }
}

function injectRenderMetadata(program: NodePath<t.Program>) {
  program.traverse({
    CallExpression(path) {
      const callee = path.get('callee')
      if (callee.isIdentifier() && /^render([A-Z]|$)/.test(callee.node.name)) {
        const stmt = path.getStatementParent()!
        path.node.arguments.push(
          // Content hash of the render call (for caching).
          t.stringLiteral(md5Hex(stmt.toString()).slice(0, 16)),
          // Start position of the render call (for client generation).
          t.numericLiteral(path.node.start!)
        )
      }
    },
  })
}
