import {
  CommonClientProps,
  InferRouteParams,
  render as renderHtml,
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
  Props extends object = CommonClientProps
>(
  route: Route,
  render: (
    module: Module,
    request: RenderRequest<Props, InferRouteParams<Route>>
  ) => Promisable<JSX.Element | null | void>
): RenderCall<JSX.Element>

/** Set the fallback renderer. */
export function render<
  Module extends object = RouteModule,
  Props extends object = CommonClientProps
>(
  render: (
    module: Module,
    request: RenderRequest<Props>
  ) => Promisable<JSX.Element>
): RenderCall<JSX.Element>

export function render(...args: [any, any?, any?]) {
  if (typeof args[0] !== 'string') {
    args.unshift('')
  }
  return defineRenderer(...args).api
}
