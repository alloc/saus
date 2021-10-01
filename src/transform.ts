import { t, NodePath } from './babel'

export function injectRenderPosition(file: NodePath<t.Program>) {
  file.node.body.forEach(stmt => {
    if (!t.isExpressionStatement(stmt)) return
    if (t.isCallExpression(stmt.expression)) {
      const call = stmt.expression
      if (isRenderCall(call)) {
        call.arguments.push(t.numericLiteral(call.start!))
      }
    }
  })
}

function isRenderCall(call: t.CallExpression) {
  return t.isIdentifier(call.callee) && call.callee.name.startsWith('render')
}
