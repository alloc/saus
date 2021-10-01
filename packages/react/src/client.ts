import fs from 'fs'
import path from 'path'
import { ClientProvider, endent } from 'stite'
import {
  t,
  babel,
  isChainedCall,
  flattenCallChain,
  NodePath,
  resolveReferences,
} from 'stite/babel'

export const getClientProvider =
  (): ClientProvider =>
  (state, renderer, { renderPath }) => {
    const { hash, start } = renderer

    const clientSkeleton = endent`
      import ReactDOM from "react-dom"
      import { state as $$state, initialRoute as $$initialRoute } from "stite/client"

      const render = () => {}
      const didRender = () => {}

      $$initialRoute.then(routeModule => {
        ReactDOM.hydrate(
          render(routeModule, $$state.routeParams, $$state),
          document.getElementById("root")
        )
        didRender()
      })
    `

    const renderCode = fs.readFileSync(renderPath, 'utf8')
    const renderFile = babel.parseSync(renderCode, {
      filename: renderPath,
      plugins: /\.tsx?$/.test(renderPath)
        ? [['@babel/syntax-typescript', { isTSX: renderPath.endsWith('x') }]]
        : [],
    })

    let renderFn: NodePath<t.ArrowFunctionExpression> | undefined
    let didRenderFn: NodePath<t.ArrowFunctionExpression> | undefined
    if (t.isFile(renderFile)) {
      let renderStmt: NodePath<t.ExpressionStatement>
      babel.traverse(renderFile, {
        Program(path) {
          renderStmt = path
            .get('body')
            .find(path => path.node.start === start) as any
        },
        Identifier(path) {
          if (!path.isDescendant(renderStmt)) return
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
            debugger
          }
        },
      })
    }

    // This visitor inserts the `render` and `didRender` implementations,
    // and any statements required by them.
    const transformer: babel.Visitor = {
      Program(path) {
        const [renderStub, didRenderStub] = path
          .get('body')
          .filter(p =>
            p.isVariableDeclaration()
          ) as NodePath<t.VariableDeclaration>[]

        let lastImportIdx = 0
        path.node.body.forEach((stmt, i) => {
          if (t.isImportDeclaration(stmt)) {
            lastImportIdx = i
          }
        })

        if (renderFn) {
          const refs = resolveReferences(renderFn)
          refs.forEach(ref => {
            // Prepend `import` statements into the client.
            if (ref.isImportDeclaration()) {
              path.node.body.unshift(ref.node)
              lastImportIdx++
            }
            // The rest should come after imports.
            else {
              path.node.body.splice(lastImportIdx + 1, 0, ref.node)
            }
          })

          const { params, body } = renderFn.node
          renderStub.traverse({
            ArrowFunctionExpression(path) {
              path.node.params = params
              path.set('body', body)
            },
          })
        }
      },
    }

    const client = babel.transformSync(clientSkeleton, {
      plugins: [{ visitor: transformer }],
      sourceMaps: true,
      comments: true,
    })!

    return {
      id: `client-${hash}${path.extname(renderPath)}`,
      state,
      code: client.code!,
      map: client.map,
    }
  }
