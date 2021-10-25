import type { JSX } from 'solid-js'
import { renderToString } from 'solid-js/web'
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
      const content = await render(mod, req)
      return content == null ? null : <div id="saus_solid">{content}</div>
    },
    renderToString,
    getClient,
    hash,
    start
  )
  return renderer.api
}
