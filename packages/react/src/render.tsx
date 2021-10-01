import fs from 'fs'
import path from 'path'
import React, { Children, ReactElement } from 'react'
import ReactDOM from 'react-dom/server'
import {
  ClientState,
  endent,
  logger,
  md5Hex,
  render as addRenderHook,
  RenderPromise,
  RenderResult,
  RouteModule,
  RouteParams,
} from 'stite'
import {
  t,
  babel,
  isChainedCall,
  flattenCallChain,
  NodePath,
} from 'stite/babel'

fixReactBug()

type RenderHook<T> = (
  module: RouteModule,
  params: RouteParams,
  state: ClientState
) => RenderResult<T>

/** Render a page for a route. */
export function render(
  route: string,
  render: RenderHook<ReactElement | null | void>,
  start?: number
): RenderPromise

/** Set the fallback renderer. */
export function render(
  render: RenderHook<ReactElement>,
  start?: number
): RenderPromise

export function render(arg1: any, arg2?: any, arg3?: any) {
  let route: string | undefined
  let promise: RenderPromise
  if (typeof arg1 === 'string') {
    const render = arg2 as RenderHook<ReactElement | null | void>
    promise = addRenderHook(
      (route = arg1),
      async (module, params, { state, didRender }) => {
        const root = await render(module, params, state)
        if (root) {
          try {
            return renderToString(root)
          } finally {
            didRender()
          }
        }
      },
      arg3
    )
  } else {
    const render = arg1 as RenderHook<ReactElement>
    promise = addRenderHook(async (module, params, { state, didRender }) => {
      const root = await render(module, params, state)
      try {
        return renderToString(root)
      } finally {
        didRender()
      }
    }, arg2)
  }
  return promise.withClient((state, renderer, { renderPath }) => {
    const { start, render } = renderer

    const clientSkeleton = endent`
      import ReactDOM from "react-dom"
      import { getState as $$getState } from "stite/client"

      const render = () => {}
      const didRender = () => {}

      const $$state = $$getState()
      import($$state.routeModuleId).then(routeModule => {
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
      plugins: [
        ['@babel/syntax-typescript', { isTSX: /\.[tj]sx$/.test(renderPath) }],
      ],
    })

    let renderFn: t.ArrowFunctionExpression | undefined
    let didRenderFn: t.ArrowFunctionExpression | undefined
    if (t.isFile(renderFile)) {
      const renderNode = renderFile.program.body.find(
        node => node.start === start
      )

      babel.traverse(renderFile, {
        Identifier(path) {
          if (!path.findParent(parent => parent.node === renderNode)) return
          const { node, parentPath } = path

          // Parse the `render(...)` call
          if (node.start === start && parentPath.isCallExpression()) {
            parentPath.node.arguments.find(arg => {
              if (t.isArrowFunctionExpression(arg)) {
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

    const transformer: babel.Visitor = {
      Program(path) {
        const [renderStub, didRenderStub] = path
          .get('body')
          .filter(p =>
            p.isVariableDeclaration()
          ) as NodePath<t.VariableDeclaration>[]

        if (renderFn) {
          const { params, body } = renderFn
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
    })!

    const hash = md5Hex(render.toString()).slice(0, 16)
    return {
      id: `client-${hash}.${path.extname(renderPath)}`,
      state,
      code: client.code!,
      map: client.map,
    }
  })
}

function renderToString(root: ReactElement) {
  if (root.type == 'html') {
    const children = Children.toArray(root.props.children)
    const headIndex = children.findIndex(
      child => isJSX(child) && child.type === 'head'
    )
    if (headIndex < 0) {
      children.unshift(<head />)
    }
    const bodyIndex = children.findIndex(
      child => isJSX(child) && child.type === 'body'
    )
    children.splice(
      bodyIndex,
      1,
      transformBody(children[bodyIndex] as ReactElement)
    )
    root.props.children = children
  } else if (root.type == 'body') {
    root = (
      <html>
        <head />
        {transformBody(root)}
      </html>
    )
  } else {
    logger.warn(`Renderer did not return <body> or <html> element`)
    return ''
  }
  return `<!DOCTYPE html>\n` + ReactDOM.renderToStaticMarkup(root)
}

function transformBody(body: ReactElement) {
  const { children, ...props } = body.props
  return (
    <body {...props}>
      <div id="root">{children}</div>
    </body>
  )
}

function isJSX(val: any): val is ReactElement {
  return val && typeof val === 'object' && 'type' in val
}

function fixReactBug() {
  const { ReactDebugCurrentFrame } = (React as any)
    .__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED

  const ReactDOMServerRendererPrototype: any = Object.getPrototypeOf(
    (ReactDOM.renderToNodeStream(<div />) as any).partialRenderer
  )

  const { render } = ReactDOMServerRendererPrototype
  ReactDOMServerRendererPrototype.render = function (...args: any[]) {
    try {
      return render.apply(this, args)
    } catch (err: any) {
      err.stack = ReactDebugCurrentFrame.getStackAddendum()
      throw err
    }
  }
}
