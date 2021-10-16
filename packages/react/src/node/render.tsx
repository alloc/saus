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
    async (mod, req) => (
      <body>
        <div id="root">{await render(mod, req)}</div>
      </body>
    ),
    { head: ReactDOM.renderToStaticMarkup, body: ReactDOM.renderToString },
    getClient,
    hash,
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
