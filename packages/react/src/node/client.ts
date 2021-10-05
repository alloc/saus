import path from 'path'
import { ClientProvider, endent, vite } from 'saus'
import {
  t,
  isChainedCall,
  flattenCallChain,
  getTrailingLineBreak,
  getWhitespaceStart,
  MagicBundle,
  MagicString,
  NodePath,
  parseFile,
  remove,
  resolveReferences,
} from 'saus/babel'

export const getClientProvider =
  (): ClientProvider =>
  ({ renderPath, configEnv }, { hash, start }) => {
    const renderFile = parseFile(renderPath)

    let renderFn: NodePath<t.ArrowFunctionExpression> | undefined
    let didRenderFn: NodePath<t.ArrowFunctionExpression> | undefined

    const renderStmt = renderFile.program
      .get('body')
      .find(
        path => path.node.start === start
      ) as NodePath<t.ExpressionStatement>

    if (!renderStmt) {
      return // Something ain't right.
    }

    renderStmt.traverse({
      Identifier(path) {
        const { node, parentPath } = path

        // Parse the `render(...)` call
        if (node.start === start && parentPath.isCallExpression()) {
          parentPath.get('arguments').find(arg => {
            if (arg.isArrowFunctionExpression()) {
              renderFn = arg
              return true
            }
          })
          path.stop()
        }

        // Parse the `.then(...)` call
        else if (isChainedCall(parentPath)) {
          const callChain = flattenCallChain(parentPath)
          if (callChain[0].node.start === start) {
            const thenCall = parentPath.parentPath as NodePath<t.CallExpression>
            thenCall.get('arguments').find(arg => {
              if (arg.isArrowFunctionExpression()) {
                didRenderFn = arg
                return true
              }
            })
          }
        }
      },
    })

    const client = new MagicBundle()
    const extracted = new Set<NodePath>()

    if (renderFn) {
      const renderDecl = renderFile.extract(renderFn)
      serverToClientRender(renderDecl, renderFn)

      const refs = resolveReferences(
        renderFn.get('body'),
        path => !path.isDescendant(renderFn!.parentPath)
      )
      refs.forEach(stmt => {
        client.addSource(renderFile.extract(stmt))
        extracted.add(stmt)
      })

      renderDecl.prepend('const render =\n')
      client.addSource(renderDecl)
    }

    if (didRenderFn) {
      const refs = resolveReferences(
        didRenderFn.get('body'),
        path => !path.isDescendant(didRenderFn!.parentPath)
      )
      refs.forEach(stmt => {
        if (extracted.has(stmt)) return
        client.addSource(renderFile.extract(stmt))
        extracted.add(stmt)
      })
      const didRenderDecl = renderFile.extract(didRenderFn)
      didRenderDecl.prepend('const didRender = ')
      client.addSource(didRenderDecl)
    }

    const defaultImports = endent`
      import ReactDOM from "react-dom"
      import { onHydrate as $onHydrate } from "saus/client"
    `

    const hydrateBlock = endent`
      $onHydrate(async (routeModule, state) => {
        ReactDOM.hydrate(
          await render(routeModule, state.routeParams, state),
          document.getElementById(state.rootId)
        )
        ${didRenderFn ? 'didRender()' : ''}
      })
    `

    client.prepend(defaultImports + '\n')
    client.append('\n' + hydrateBlock)

    const code = client.toString()
    const map = client.generateMap({
      includeContent: true,
    })

    return {
      id: `client-${hash}${path.extname(renderPath)}`,
      code,
      map,
    }
  }

// The client only needs to hydrate the <body> tree,
// so <html> and <head> can (and should) be removed.
function serverToClientRender(
  output: MagicString,
  renderFn: NodePath<t.ArrowFunctionExpression>
) {
  let bodyRefs: NodePath<t.Statement>[]

  renderFn.traverse({
    JSXElement(path) {
      if (!path.parentPath.isReturnStatement()) return
      path.skip()

      const rootElement = path
      const rootStart = getWhitespaceStart(path.node.start!, output.original)
      const rootEnd = getTrailingLineBreak(
        path.get('closingElement').node!.end!,
        output.original
      )

      path.parentPath.traverse({
        JSXElement(path) {
          const tagName = path.get('openingElement').get('name')
          if (!tagName.isJSXIdentifier()) {
            return
          }
          if (tagName.equals('name', 'head')) {
            return path.skip()
          }
          if (tagName.equals('name', 'body')) {
            path.stop()

            // Find statements used in the <body> element tree.
            bodyRefs = resolveReferences(path, path =>
              path.isDescendant(renderFn.get('body'))
            )

            const children = path.node.children.filter(
              child => !t.isJSXText(child) || !!child.value.trim()
            )

            // Even though we won't be generating code from the
            // Babel AST, we still need to update it so future
            // calls to "resolveReferences" are accurate.
            rootElement.replaceWith(
              children.length == 1
                ? children[0]
                : t.jsxFragment(
                    t.jsxOpeningFragment(),
                    t.jsxClosingFragment(),
                    path.node.children
                  )
            )

            const bodyStart = children[0].start!
            const bodyEnd = children[children.length - 1].end!

            // Turn the children of <body> into the root element,
            // wrapping in a React fragment if necessary.
            output.remove(rootStart, bodyStart)
            output.remove(bodyEnd, rootEnd)
            if (children.length > 1) {
              output.appendLeft(bodyStart, '<>')
              output.appendRight(bodyEnd, '</>')
            }
          }
        },
      })
    },
  })

  const removed = new Set<NodePath>()

  // Remove any statements not needed to render the <body> subtree.
  renderFn.get('body').traverse({
    enter(path) {
      if (!path.isStatement()) return
      if (path.isExpressionStatement()) {
        // Preserve expressions whose result is unused…
        const expr = path.get('expression')
        const refs = resolveReferences(expr, path => {
          return !path.isDescendant(expr)
        })
        // …unless it references a removed statement.
        if (!refs.some(stmt => removed.has(stmt))) {
          return path.skip()
        }
      }
      // Preserve these statement types.
      else if (path.isReturnStatement() || path.isDebuggerStatement()) {
        return path.skip()
      }
      // Is this statement used in the <body> subtree?
      if (!bodyRefs.includes(path)) {
        removed.add(path)
        remove(path, output)
        path.skip()
      }
    },
  })

  // Update the Babel AST for future traversals.
  removed.forEach(path => path.remove())
}
