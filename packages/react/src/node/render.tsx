import React, { Children, ReactElement } from 'react'
import ReactDOM from 'react-dom/server'
import {
  logger,
  render as addRenderHook,
  ClientState,
  InferRouteParams,
  PageRequest,
  RenderCall,
  RouteModule,
} from 'saus'
import { getClientProvider } from './client'

fixReactBug()

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
    request: PageRequest<State, InferRouteParams<Route>>
  ) => Promisable<JSX.Element | null | void>
): RenderCall

/** Set the fallback renderer. */
export function render<
  Module extends object = RouteModule,
  State extends object = ClientState
>(
  render: (
    module: Module,
    request: PageRequest<State>
  ) => Promisable<JSX.Element>
): RenderCall

export function render(...args: any[]) {
  if (typeof args[0] === 'string') {
    const [route, render, hash, start] = args
    return addRenderHook(
      route,
      async (module, request, { didRender }) => {
        const root = await render(module, request)
        if (root) {
          try {
            return renderToString(root)
          } finally {
            didRender()
          }
        }
      },
      hash,
      start
    ).withClient(getClientProvider())
  } else {
    const [render, hash, start] = args
    return addRenderHook(
      async (module, request, { didRender }) => {
        const root = await render(module, request)
        try {
          return renderToString(root)
        } finally {
          didRender()
        }
      },
      hash,
      start
    ).withClient(getClientProvider())
  }
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
    root = React.cloneElement(root, {
      children,
    })
  } else {
    if (root.type !== 'body') {
      root = <body>{root}</body>
    }
    root = (
      <html>
        <head />
        {transformBody(root)}
      </html>
    )
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
      err.stack =
        err.constructor.name +
        ': ' +
        err.message +
        ReactDebugCurrentFrame.getStackAddendum()

      throw err
    }
  }
}
