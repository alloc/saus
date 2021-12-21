import * as vite from 'vite'
import annotateAsPure from '@babel/helper-annotate-as-pure'
import { babel, transformSync, t, NodePath } from '../babel'
import { SausContext } from '../core'
import { isClientUrl } from './client'

export function renderPlugin({
  renderPath,
  configEnv,
}: SausContext): vite.Plugin {
  return {
    name: 'saus:render',
    enforce: 'pre',
    transform(code, id) {
      let visitor: babel.Visitor | undefined
      if (id === renderPath) {
        visitor = { Program: injectRenderMetadata }
      } else if (isClientUrl(id) && configEnv.mode === 'production') {
        visitor = { CallExpression: assumePurity }
      }
      if (visitor) {
        return transformSync(code, id, [{ visitor }]) as vite.TransformResult
      }
    },
  }
}

export const renderIdentRE = /^(beforeRender$|render([A-Z]|$))/

// Append the node position to render-related calls.
function injectRenderMetadata(program: NodePath<t.Program>) {
  program.traverse({
    CallExpression(path) {
      const callee = path.get('callee')
      if (callee.isIdentifier() && renderIdentRE.test(callee.node.name)) {
        path.node.arguments.push(
          // Start position of the render call (for client generation).
          t.numericLiteral(path.node.start!)
        )
      }
    },
  })
}

// Function calls whose result is used are assumed to be pure.
// This makes it easier for Rollup to treeshake them.
function assumePurity(call: NodePath<t.CallExpression>) {
  if (!call.parentPath.isExpressionStatement()) {
    annotateAsPure(call)
  }
}
