import {
  getTrailingLineBreak,
  MagicString,
  resolveReferences,
  t,
} from '@/babel'
import type { ClientFunction } from '../core'
import type { IsolatedModule } from './isolateRoutes'

/**
 * Each renderer gets its own chunk so it can be reloaded once
 * per rendered page.
 */
export function createRendererChunk(
  type: 'render' | 'beforeRender',
  func: ClientFunction,
  editor: MagicString
): IsolatedModule {
  const preservedRanges: [number, number][] = []
  const preserveRange = (p: { node: t.Node }) =>
    preservedRanges.push([
      p.node.start!,
      getTrailingLineBreak(p.node.end!, editor.original),
    ])

  const callee = func.callee!
  let callExpr = callee.findParent(p =>
    p.isCallExpression()
  )! as babel.NodePath<t.CallExpression>

  // Preserve the render/beforeRender call and any chained calls.
  const callStmt = callExpr.getStatementParent()!
  preserveRange(callStmt)

  // Preserve any referenced statements.
  while ((callExpr = callExpr.findParent(p => p.isCallExpression()) as any)) {
    resolveReferences(callExpr.get('arguments')).forEach(preserveRange)
  }
  resolveReferences(callee).forEach(preserveRange)
  func.referenced.forEach(preserveRange)

  // Sort the preserved ranges in order of appearance.
  preservedRanges.sort(([a], [b]) => a - b)

  // Remove the unused ranges.
  let minStart = 0
  editor.remove(0, preservedRanges[0][0])
  preservedRanges.forEach(([, removedStart], i) => {
    if (removedStart < minStart) {
      removedStart = minStart
    }
    const nextRange = preservedRanges[i + 1]
    const removedEnd = nextRange ? nextRange[0] - 1 : editor.original.length
    if (removedStart < removedEnd) {
      editor.remove(removedStart, removedEnd)
    } else {
      minStart = removedStart
    }
  })

  return {
    code: editor.toString(),
    map: editor.generateMap(),
  }
}
