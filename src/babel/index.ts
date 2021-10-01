import * as babel from '@babel/core'
import { types as t, NodePath } from '@babel/core'

export { babel, t, NodePath }

export function toStaticParams(params: Record<string, string>) {
  return t.objectExpression(
    Object.keys(params).map(key =>
      t.objectProperty(t.identifier(key), t.stringLiteral(params[key]))
    )
  )
}

export function extractHydrateHook(file: NodePath<t.Program>) {}

export function resolveReferences(stmts: NodePath<t.Statement>[]): NodePath[] {
  if (!stmts.length) return []

  const crawled = new Set<NodePath>()
  const referenced = new Set<NodePath>()
  stmts.forEach(collectFrom)

  function collectFrom(basePath: babel.NodePath) {
    console.log('crawl: %O', basePath.getSource())
    crawled.add(basePath)
    basePath.traverse({
      JSXIdentifier: onIdentifier,
      Identifier: onIdentifier,
    })
    function onIdentifier(
      path: babel.NodePath<t.Identifier | t.JSXIdentifier>
    ) {
      const { parentPath } = path
      if (parentPath.isMemberExpression() || parentPath.isJSXClosingElement()) {
        return
      }
      const { name } = path.node
      if (path.isJSXIdentifier() && /^[a-z]/.test(name)) {
        return
      }
      const binding = path.scope.getBinding(name)
      if (!binding) {
        return
      }
      const bindPath = binding.path
      if (!getFirstAncestor(bindPath, p => referenced.has(p))) {
        useNode(bindPath)
        if (
          !crawled.has(bindPath) &&
          !getFirstAncestor(bindPath, p => crawled.has(p))
        ) {
          crawled.add(bindPath)
          collectFrom(bindPath)
        }
      }
    }
  }

  function useNode(path: babel.NodePath | undefined) {
    if (path && !referenced.has(path)) {
      if (path.isStatement()) {
        console.log('used: %O', path.getSource())
        referenced.add(path)
      }
      const { parentPath } = path
      if (parentPath && !parentPath.isProgram()) {
        useNode(parentPath)
      }
    }
  }

  return Array.from(referenced).sort((a, b) => {
    return a.node.start! - b.node.start!
  })
}

export function isChainedCall(path: NodePath) {
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
    calls.unshift(path)
    flattenCallChain(path.get('callee'), calls)
  } else if (isChainedCall(path)) {
    const parentPath = path.parentPath as NodePath<t.MemberExpression>
    flattenCallChain(
      parentPath.get('object') as NodePath<t.CallExpression>,
      calls
    )
  }
  return calls
}

export function getSourceFile(path: NodePath) {
  return path.findParent(path => path.isFile()) as NodePath<t.File>
}

export function getImportDeclaration(
  program: NodePath<t.Program>,
  moduleName: string
) {
  return program
    .get('body')
    .find(
      stmt => stmt.isImportDeclaration() && stmt.node.source.value == moduleName
    ) as NodePath<t.ImportDeclaration> | undefined
}

export function getImportDeclarations(program: NodePath<t.Program>) {
  return program
    .get('body')
    .filter(stmt =>
      stmt.isImportDeclaration()
    ) as NodePath<t.ImportDeclaration>[]
}

export function getFirstAncestor(
  path: NodePath,
  test: (path: NodePath) => boolean
) {
  let parentPath = path.parentPath
  while (parentPath && !test(parentPath)) {
    parentPath = path.parentPath
  }
  return parentPath
}
