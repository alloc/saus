import { t, collectNodes, getImportDeclaration, NodePath } from 'stite/babel'
import { logger } from 'stite'

export function generateClient(program: NodePath<t.Program>) {
  const importDecl = getImportDeclaration(program, '@stite/react')!
  const renderSpec = importDecl
    .getNamedImports()
    .find(spec => 'render' === spec.getName())!

  // Find references to `render` import
  const renderRefs = file
    .getProject()
    .getLanguageService()
    .findReferencesAsNodes(
      renderSpec.getAliasNode() || renderSpec.getNameNode()
    )

  const renderCalls = renderRefs
    .map(renderRef => renderRef.getParentIfKind(ts.SyntaxKind.CallExpression))
    .filter(Boolean) as CallExpression[]

  let renderFn!: ArrowFunction
  renderCalls.reverse().some(renderCall => {
    const [routeString, renderArg] = renderCall.getArguments()
    if (!Node.isStringLiteral(routeString)) {
      logger.warn(`Route passed to "render" must be string literal`)
      return false
    }
    if (route == routeString.getLiteralValue()) {
      if (!Node.isArrowFunction(renderArg)) {
        badSyntax(
          `Expected "render" to receive an inline arrow function`,
          renderCall
        )
      }
      renderFn = renderArg
      return true
    }
  })

  // TODO: render the nodes used by <body>
  collectNodes(renderFn.getBody())
}

function badSyntax(reason: string, node: Node): never {
  const err: any = SyntaxError(reason)
  err.loc = {
    line: node.getStartLineNumber(),
    column: node.getPos() - node.getStartLinePos(),
  }
  throw err
}
