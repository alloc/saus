import fs from 'fs'
import * as babel from '@babel/core'
import { types as t, NodePath } from '@babel/core'
import MagicString from 'magic-string'

export { babel, t, NodePath }

export function toStaticParams(params: Record<string, string>) {
  return t.objectExpression(
    Object.keys(params).map(key =>
      t.objectProperty(t.identifier(key), t.stringLiteral(params[key]))
    )
  )
}

export function extractHydrateHook(file: NodePath<t.Program>) {}

const toArray = <T>(arg: T): T extends any[] ? T : T[] =>
  Array.isArray(arg) ? arg : ([arg] as any)

export function resolveReferences(
  fn: NodePath<t.ArrowFunctionExpression>
): NodePath<t.Statement>[] {
  const crawled = new Set<NodePath>([fn])
  const referenced = new Set<NodePath<t.Statement>>()

  toArray(fn.get('body')).forEach(crawl)

  function crawl(basePath: NodePath) {
    crawled.add(basePath)
    basePath.traverse({
      JSXIdentifier: onIdentifier,
      Identifier: onIdentifier,
    })
  }

  function onIdentifier(path: babel.NodePath<t.Identifier | t.JSXIdentifier>) {
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
      return // Undeclared variable
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
    if (path && !path.isDescendant(fn.parentPath)) {
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
    parentPath = parentPath.parentPath
  }
  return parentPath
}

export function parseFile(filename: string, source?: string) {
  return new File(filename, source)
}

class File {
  program!: NodePath<t.Program>

  constructor(
    readonly filename: string,
    readonly source = fs.readFileSync(filename, 'utf8')
  ) {
    const syntaxPlugins = /\.tsx?$/.test(filename)
      ? [['@babel/syntax-typescript', { isTSX: filename.endsWith('x') }]]
      : []

    const visitor: babel.Visitor = {
      Program: path => {
        this.program = path
        path.stop()
      },
    }

    babel.transformSync(source, {
      filename,
      plugins: [...syntaxPlugins, { visitor }],
    })
  }

  extract(path: NodePath) {
    const { node } = path
    if (node.start == null || node.end == null) {
      throw Error('Missing node start/end')
    }
    if (!this.program.isAncestor(path)) {
      throw Error('Given node is not from this file')
    }
    const { source, filename } = this
    const str = new MagicString(source, { filename } as any)
    str.remove(0, node.start)
    str.remove(node.end, source.length)
    return str
  }
}
