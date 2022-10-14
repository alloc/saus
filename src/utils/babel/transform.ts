import * as babel from '@babel/core'
import { NodePath, transformFromAstSync, types as t } from '@babel/core'
import MagicString from 'magic-string'
import { getBabelConfig } from './config'
import { getTrailingLineBreak, getWhitespaceStart } from './queries'

export const transformSync = (
  code: string,
  filename: string,
  config: babel.TransformOptions | babel.PluginItem[]
) => babel.transformSync(code, getBabelConfig(filename, config))

export const transformAsync = (
  code: string,
  filename: string,
  config: babel.TransformOptions | babel.PluginItem[]
) => babel.transformAsync(code, getBabelConfig(filename, config))

export function removeSSR(source: MagicString): babel.Visitor {
  return {
    MetaProperty(path) {
      if (!path.get('meta').isIdentifier({ name: 'import' })) return
      const expr = path.findParent(p => !p.parentPath?.isMemberExpression())!
      if (expr.toString() == 'import.meta.env.SSR') {
        const parent = expr.parentPath!
        if (expr.parentKey == 'test') {
          if (parent.isIfStatement() || parent.isConditionalExpression()) {
            if (parent.node.alternate) {
              replaceWith(parent, parent.node.alternate, source)
            } else {
              remove(parent, source)
            }
          } else {
            replaceWith(expr, 'false', source)
          }
        } else if (
          expr.parentKey == 'left' &&
          parent.equals('operator', '&&')
        ) {
          replaceWith(parent, 'false', source)
        } else {
          replaceWith(expr, 'false', source)
        }
      }
    },
  }
}

export function replaceWith(
  path: NodePath,
  replacement: babel.Node | string,
  source: MagicString
) {
  const [start, end] = getExpandedRange(path, source)
  if (typeof replacement === 'string') {
    path.replaceWithSourceString(replacement)
    source.overwrite(start, end, replacement)
  } else {
    let stmts: t.Statement[]
    if (t.isBlockStatement(replacement)) {
      stmts = replacement.body
    } else if (t.isStatement(replacement)) {
      stmts = [replacement]
    } else if (t.isExpression(replacement)) {
      stmts = [t.expressionStatement(replacement)]
    } else {
      throw new Error(`Node type not supported by "replaceWith"`)
    }
    const { code: replacementString } = transformFromAstSync(t.program(stmts))!
    source.overwrite(start, end, replacementString!)
    path.replaceWith(replacement)
  }
}

/** Remove a `NodePath`, its preceding whitespace, and its trailing newline (if one exists). */
export function remove(path: NodePath, source: MagicString) {
  const [start, end] = getExpandedRange(path, source)
  source.remove(start, end)
  path.remove()
}

function getExpandedRange(path: NodePath, source: MagicString) {
  let start = path.node.start!
  let end = path.node.end!
  if (path.node.leadingComments) {
    start = path.node.leadingComments.reduce(
      (start, comment) => Math.min(start, comment.start!),
      start
    )
  }
  start = getWhitespaceStart(start, source.original)
  end = getTrailingLineBreak(end, source.original)
  return [start, end] as const
}
