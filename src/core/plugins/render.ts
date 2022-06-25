import annotateAsPure from '@babel/helper-annotate-as-pure'
import * as vite from 'vite'
import { babel, NodePath, t, transformSync } from '../babel'
import { renderIdentRE } from '../clientFunctions'
import { SausConfig } from '../core'
import { isClientId } from './clientEntries'

export function renderPlugin(
  { render: renderPath }: SausConfig,
  configEnv: vite.ConfigEnv
): vite.Plugin {
  return {
    name: 'saus:render',
    enforce: 'pre',
    transform(code, id) {
      let visitor: babel.Visitor | undefined
      if (id === renderPath) {
        visitor = { Program: injectRenderMetadata }
      } else if (isClientId(id) && configEnv.command === 'build') {
        visitor = { CallExpression: assumePurity }
      }
      if (visitor) {
        return transformSync(code, id, [{ visitor }]) as vite.TransformResult
      }
    },
  }
}

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
