import { NodePath, t } from './babel'

export function getWhitespaceStart(start: number, source: string) {
  return start - /(^|\n)([\n ]*)$/.exec(source.slice(0, start))![2].length
}

export function getTrailingLineBreak(end: number, source: string) {
  return source[end] === '\n' ? end + 1 : end
}

export function getFirstAncestor(
  path: NodePath,
  test: (path: NodePath) => boolean
) {
  let parentPath = path.parentPath
  while (parentPath && !test(parentPath)) {
    parentPath = parentPath.parentPath
  }
  return parentPath
}

export function isChainedCall(
  path: NodePath
): path is NodePath<t.MemberExpression> {
  return (
    path.isMemberExpression() &&
    path.parentKey === 'callee' &&
    path.get('object').isCallExpression()
  )
}

export function flattenCallChain(
  path: NodePath,
  calls: NodePath<t.CallExpression>[] = []
) {
  if (path.isCallExpression()) {
    flattenCallChain(path.get('callee'), calls)
    calls.push(path)
  } else if (isChainedCall(path)) {
    flattenCallChain(path.get('object'), calls)
    calls.push(path.parentPath as NodePath<t.CallExpression>)
  }
  return calls
}

/**
 * Is the given node path either…
 *   - the name of an object property being declared
 *   - the name of a property being accessed
 */
export function isPropertyName({ parentKey, parentPath }: NodePath) {
  return (
    parentPath &&
    ((parentPath.isObjectProperty() &&
      !parentPath.node.computed &&
      parentKey === 'key') ||
      (parentPath.isMemberExpression() &&
        !parentPath.node.computed &&
        parentKey === 'property'))
  )
}

export function isConsoleCall(path: NodePath) {
  if (!path.isCallExpression()) return false
  const callee = path.get('callee')
  return (
    callee.isMemberExpression() &&
    callee.get('object').isIdentifier({ name: 'console' })
  )
}
