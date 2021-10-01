import fs from 'fs'
import MagicString, { Bundle } from 'magic-string'
import path from 'path'
import { ClientProvider, endent } from 'saus'
import {
  t,
  babel,
  isChainedCall,
  flattenCallChain,
  NodePath,
  resolveReferences,
  File,
} from 'saus/babel'

export const getClientProvider =
  (): ClientProvider =>
  (state, renderer, { renderPath }) => {
    const { hash, start } = renderer
    const renderFile = new File(renderPath)

    let renderFn: NodePath<t.ArrowFunctionExpression> | undefined
    let didRenderFn: NodePath<t.ArrowFunctionExpression> | undefined

    const renderStmt = renderFile.program
      .get('body')
      .find(
        path => path.node.start === start
      ) as NodePath<t.ExpressionStatement>

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
                path.stop()
                rootElement.replaceWith(
                  t.jsxFragment(
                    t.jsxOpeningFragment(),
                    t.jsxClosingFragment(),
                    path.node.children
                  )
                )
              }
            },
          })
        },
      })
      const refs = resolveReferences(renderFn)
      refs.forEach(ref => {
        clientBundle.addSource(renderFile.extract(ref))
        extracted.add(ref)
      })
      const renderDecl = renderFile.extract(renderFn)
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
      import { state as $$state, initialRoute as $$initialRoute } from "saus/client"
    `

    const hydrateBlock = endent`
      $$initialRoute.then(routeModule => {
        ReactDOM.hydrate(
          render(routeModule, $$state.routeParams, $$state),
          document.getElementById("root")
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
      state,
      code,
      map,
    }
  }
