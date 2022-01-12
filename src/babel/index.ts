import * as babel from '@babel/core'
import { types as t, NodePath, transformFromAstSync } from '@babel/core'
import MagicString, { Bundle as MagicBundle } from 'magic-string'

export { babel, t, NodePath, MagicString, MagicBundle }

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

export function getExportDeclarations(program: NodePath<t.Program>) {
  return program
    .get('body')
    .filter(stmt =>
      stmt.isExportDeclaration()
    ) as NodePath<t.ExportDeclaration>[]
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

export function inferSyntaxPlugins(filename: string): babel.PluginItem[] {
  return /\.tsx?$/.test(filename)
    ? [['@babel/syntax-typescript', { isTSX: filename.endsWith('x') }]]
    : []
}

export function getBabelConfig(
  filename: string,
  config: babel.TransformOptions | babel.PluginItem[] = {}
) {
  if (Array.isArray(config)) {
    config = { plugins: config }
  }
  const syntaxPlugins = inferSyntaxPlugins(filename)
  if (syntaxPlugins.length) {
    config.plugins = syntaxPlugins.concat(config.plugins || [])
  }
  return {
    filename,
    babelrc: false,
    configFile: false,
    sourceMaps: true,
    ...config,
  }
}

export function getBabelProgram(source: string, filename: string) {
  let program: NodePath<t.Program> | undefined
  const visitor: babel.Visitor = {
    Program: path => {
      program = path
      path.stop()
    },
  }

  // Use the AST for traversal, but not code generation.
  transformSync(source, filename, {
    plugins: [{ visitor }],
    sourceMaps: false,
    code: false,
  })

  return program!
}

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
      (start, comment) => Math.min(start, comment.start),
      start
    )
  }
  start = getWhitespaceStart(start, source.original)
  end = getTrailingLineBreak(end, source.original)
  return [start, end] as const
}

export function getWhitespaceStart(start: number, source: string) {
  return start - /(^|\n)([\n ]*)$/.exec(source.slice(0, start))![2].length
}

export function getTrailingLineBreak(end: number, source: string) {
  return source[end] === '\n' ? end + 1 : end
}

export function isConsoleCall(path: NodePath) {
  if (!path.isCallExpression()) return false
  const callee = path.get('callee')
  return (
    callee.isMemberExpression() &&
    callee.get('object').isIdentifier({ name: 'console' })
  )
}
