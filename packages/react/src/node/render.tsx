import React from 'react'
import ReactDOM from 'react-dom/server'
import {
  render as createRenderer,
  ClientState,
  InferRouteParams,
  RenderCall,
  RenderRequest,
  RouteModule,
} from 'saus/core'
import client from './client'

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
  const [route, render, start] = args
  const renderer = createRenderer<JSX.Element>(
    route,
    async (mod, req) => {
      const content = await render(mod, req)
      return content == null ? null : <div id="saus_react">{content}</div>
    },
    { head: ReactDOM.renderToStaticMarkup, body: ReactDOM.renderToString },
    client,
    start
  )
  return renderer.api
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

  const stackFrameRE = /^ {4}at (?:.+?\s+\()?.+?:\d+(?::\d+)?\)?/m

  const { render } = ReactDOMServerRendererPrototype
  ReactDOMServerRendererPrototype.render = function (...args: any[]) {
    try {
      return render.apply(this, args)
    } catch (err: any) {
      const componentStack = ReactDebugCurrentFrame.getStackAddendum()
      const firstFrame = stackFrameRE.exec(err.stack)
      if (firstFrame) {
        const index = firstFrame.index + firstFrame[0].length
        err.stack =
          err.stack.slice(0, index) + componentStack + err.stack.slice(index)
      } else {
        err.message += componentStack
      }
      throw err
    }
  }
}
