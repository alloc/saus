import { toArray } from '@utils/array'
import { babel, NodePath, t } from '@utils/babel'
import { getFirstAncestor, isPropertyName } from '@utils/babel/queries'

export function resolveReferences(
  rootPaths: NodePath | NodePath[],
  filter = (_path: NodePath) => true
): NodePath<t.Statement>[] {
  const crawled = new Set<NodePath>()
  const referenced = new Set<NodePath<t.Statement>>()

  toArray(rootPaths).forEach(crawl)

  function crawl(basePath: NodePath) {
    crawled.add(basePath)
    if (basePath.isIdentifier() || basePath.isJSXIdentifier()) {
      return onIdentifier(basePath)
    }
    basePath.traverse({
      JSXIdentifier: onIdentifier,
      Identifier: onIdentifier,
    })
  }

  function onIdentifier(path: NodePath<t.Identifier | t.JSXIdentifier>) {
    const { parentPath } = path
    if (parentPath.isJSXClosingElement() || isPropertyName(path)) {
      return
    }

    const { name } = path.node
    if (path.isJSXIdentifier() && /^[a-z]/.test(name)) {
      return
    }

    const binding = path.scope.getBinding(name)
    if (!binding) {
      return // Global or undeclared variable
    }

    const bindPath = binding.path
    if (getFirstAncestor(bindPath, p => referenced.has(p as any))) {
      return // Inside a referenced statement
    }

    addReference(bindPath)

    if (
      crawled.has(bindPath) ||
      getFirstAncestor(bindPath, p => crawled.has(p))
    ) {
      return // Already crawled
    }

    crawl(bindPath)
  }

  function addReference(path: babel.NodePath | null | undefined) {
    if (path && filter(path)) {
      path = path.getStatementParent()
      if (path) {
        referenced.add(path as NodePath<t.Statement>)
      }
    }
  }

  return Array.from(referenced).sort((a, b) => {
    return a.node.start! - b.node.start!
  })
}
