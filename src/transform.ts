import md5Hex from 'md5-hex'
import { t, NodePath } from './babel'

export function injectRenderMetadata(file: NodePath<t.Program>) {
  file.get('body').forEach(stmt => {
    if (!stmt.isExpressionStatement()) return
    const call = stmt.get('expression')
    if (call.isCallExpression() && isRenderCall(call.node)) {
      call.node.arguments.push(
        // Content hash of the render call (for caching).
        t.stringLiteral(md5Hex(call.toString()).slice(0, 16)),
        // Start position of the render call (for client generation).
        t.numericLiteral(call.node.start!)
      )
    }
  })
}

function isRenderCall(call: t.CallExpression) {
  return t.isIdentifier(call.callee) && call.callee.name.startsWith('render')
}
