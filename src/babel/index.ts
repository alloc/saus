import fs from 'fs'
import * as babel from '@babel/core'
import { types as t, NodePath } from '@babel/core'
import MagicString, { Bundle as MagicBundle } from 'magic-string'

export { babel, t, NodePath, MagicString, MagicBundle }

export function toStaticParams(params: Record<string, string>) {
  return t.objectExpression(
    Object.keys(params).map(key =>
      t.objectProperty(t.identifier(key), t.stringLiteral(params[key]))
    )
  )
}

const toArray = <T>(arg: T): T extends any[] ? T : T[] =>
  Array.isArray(arg) ? arg : ([arg] as any)

export function resolveReferences(
  rootPaths: NodePath | NodePath[],
  filter = (_path: NodePath) => false
): NodePath<t.Statement>[] {
  const crawled = new Set<NodePath>()
  const referenced = new Set<NodePath<t.Statement>>()

  toArray(rootPaths).forEach(crawl)

  function crawl(basePath: NodePath) {
    crawled.add(basePath)
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

/** Remove a `NodePath`, its preceding whitespace, and its trailing newline (if one exists). */
export function remove(path: NodePath, source: MagicString) {
  let start = path.node.start!
  let end = path.node.end!
  start = getWhitespaceStart(start, source.original)
  end = getTrailingLineBreak(end, source.original)
  source.remove(start, end)
}

export function getWhitespaceStart(start: number, source: string) {
  while (source[start - 1] === ' ') start--
  return start
}

export function getTrailingLineBreak(end: number, source: string) {
  return source[end] === '\n' ? end + 1 : end
}
