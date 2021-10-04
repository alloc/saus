import path from 'path'
import MagicString, { Bundle } from 'magic-string'
import { ClientProvider, endent } from 'saus'
import {
  t,
  isChainedCall,
  flattenCallChain,
  NodePath,
  parseFile,
  resolveReferences,
} from 'saus/babel'

export const getClientProvider =
  (): ClientProvider =>
  ({ renderPath }, { hash, start }) => {
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

    const clientBundle = new Bundle()
    const extracted = new Set<NodePath>()

    if (renderFn) {
      const refs = resolveReferences(renderFn)
      refs.forEach(ref => {
        clientBundle.addSource(renderFile.extract(ref))
        extracted.add(ref)
      })

      const renderDecl = renderFile.extract(renderFn)
      serverToClientRender(renderDecl, renderFn)

      renderDecl.prepend('const render = ')
      clientBundle.addSource(renderDecl)
    }

    if (didRenderFn) {
      const refs = resolveReferences(didRenderFn)
      refs.forEach(ref => {
        if (extracted.has(ref)) return
        clientBundle.addSource(renderFile.extract(ref))
        extracted.add(ref)
      })
      const didRenderDecl = renderFile.extract(didRenderFn)
      didRenderDecl.prepend('const didRender = ')
      clientBundle.addSource(didRenderDecl)
    }

    const defaultImports = endent`
      import ReactDOM from "react-dom"
      import { onHydrate as $onHydrate } from "saus/client"
    `

    const hydrateBlock = endent`
      $onHydrate((routeModule, state) => {
        ReactDOM.hydrate(
          render(routeModule, state.routeParams, state),
          document.getElementById(state.rootId)
        )
        ${didRenderFn ? 'didRender()' : ''}
      })
    `

    clientBundle.prepend(defaultImports + '\n')
    clientBundle.append('\n' + hydrateBlock)

    const code = clientBundle.toString()
    const map = clientBundle.generateMap()

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
  renderFn.traverse({
    JSXElement(path) {
      if (!path.parentPath.isReturnStatement()) {
        return
      }
      const rootElement = path
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
            const { children } = path.node
            path.stop()

            // Replace <body> (and any parent elements) with React fragment.
            output.overwrite(rootElement.node.start!, children[0].start!, '<>')
            output.overwrite(
              children[children.length - 1].end!,
              rootElement.get('closingElement').node!.end!,
              '</>'
            )
          }
        },
      })
      path.stop()
    },
  })
}
