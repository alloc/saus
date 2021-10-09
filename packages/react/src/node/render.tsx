import React, { Children, ReactElement } from 'react'
import ReactDOM from 'react-dom/server'
import {
  render as createRenderer,
  ClientState,
  InferRouteParams,
  RenderCall,
  RenderRequest,
  RouteModule,
} from 'saus/core'
import { getClient } from './client'

type Promisable<T> = T | PromiseLike<T>

/** Render a page for a route. */
export function render<
  Route extends string,
  Module extends object = RouteModule,
  State extends object = ClientState
>(
  route: Route,
  render: (
    module: Module,
    request: RenderRequest<State, InferRouteParams<Route>>
  ) => Promisable<JSX.Element | null | void>
): RenderCall<JSX.Element>

/** Set the fallback renderer. */
export function render<
  Module extends object = RouteModule,
  State extends object = ClientState
>(
  render: (
    module: Module,
    request: RenderRequest<State>
  ) => Promisable<JSX.Element>
): RenderCall<JSX.Element>

export function render(...args: any[]) {
  if (typeof args[0] !== 'string') {
    args.unshift('')
  }
  const [route, render, hash, start] = args
  const renderer = createRenderer<JSX.Element>(
    route,
    async (mod, req) => {
      let root = await render(mod, req)
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
        return React.cloneElement(root, {
          children,
        })
      }
      if (root.type !== 'body') {
        root = <body>{root}</body>
      }
      return (
        <html>
          <head />
          {transformBody(root)}
        </html>
      )
    },
    ReactDOM.renderToStaticMarkup,
    getClient,
    hash,
    start
  )
  return renderer.api
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

fixReactBug()

// Ensure the component stack is included in stack traces.
function fixReactBug() {
  const { ReactDebugCurrentFrame } = (React as any)
    .__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED

  // Avoid crashing in case two instances of React are present.
  if (!ReactDebugCurrentFrame) {
    return
  }

  const ReactDOMServerRendererPrototype: any = Object.getPrototypeOf(
    (ReactDOM.renderToNodeStream(<div />) as any).partialRenderer
  )

  const { render } = ReactDOMServerRendererPrototype
  ReactDOMServerRendererPrototype.render = function (...args: any[]) {
    try {
      return render.apply(this, args)
    } catch (err: any) {
      err.stack =
        err.constructor.name +
        ': ' +
        err.message +
        ReactDebugCurrentFrame.getStackAddendum()

      throw err
    }
  }
}
