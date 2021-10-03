import React, { Children, ReactElement } from 'react'
import ReactDOM from 'react-dom/server'
import {
  ClientState,
  logger,
  render as addRenderHook,
  RenderCall,
  RouteModule,
  RouteParams,
} from 'saus'
import { getClientProvider } from './client'

fixReactBug()

type RenderHook<T> = (
  module: RouteModule,
  props: RouteParams,
  state: ClientState
) => T | Promise<T>

/** Render a page for a route. */
export function render(
  route: string,
  render: RenderHook<ReactElement | null | void>,
  hash?: string,
  start?: number
): RenderCall

/** Set the fallback renderer. */
export function render(
  render: RenderHook<ReactElement>,
  hash?: string,
  start?: number
): RenderCall

export function render(...args: [any, any, any, any?]) {
  if (typeof args[0] === 'string') {
    const render = args[1] as RenderHook<ReactElement | null | void>
    return addRenderHook(
      args[0],
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
      args[2],
      args[3]
    ).withClient(getClientProvider())
  } else {
    const render = args[0] as RenderHook<ReactElement>
    return addRenderHook(
      async (module, params, { state, didRender }) => {
        const root = await render(module, params, state)
        try {
          return renderToString(root)
        } finally {
          didRender()
        }
      },
      args[1],
      args[2]
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
      err.stack =
        err.constructor.name +
        ': ' +
        err.message +
        ReactDebugCurrentFrame.getStackAddendum()

      throw err
    }
  }
}
