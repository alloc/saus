import {
  render as renderHtml,
  ClientState,
  InferRouteParams,
  RenderCall,
  RenderRequest,
  RouteModule,
} from 'saus/core'
import { renderTo } from './renderTo'

type Promisable<T> = T | PromiseLike<T>

const defineRenderer = renderTo(renderHtml)

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

export function render(...args: [any, any?, any?]) {
  if (typeof args[0] !== 'string') {
    args.unshift('')
  }
  return defineRenderer(...args).api
}
