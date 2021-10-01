import md5Hex from 'md5-hex'
import { t, NodePath } from './babel'

export function injectRenderMetadata(file: NodePath<t.Program>) {
  file.traverse({
    CallExpression(path) {
      const callee = path.get('callee')
      if (callee.isIdentifier() && /^render([A-Z]|$)/.test(callee.node.name)) {
        path.node.arguments.push(
          // Content hash of the render call (for caching).
          t.stringLiteral(md5Hex(path.toString()).slice(0, 16)),
          // Start position of the render call (for client generation).
          t.numericLiteral(path.node.start!)
        )
      }
    },
  })
}
