import type {
  CommonClientProps,
  InferRouteParams,
  RenderCall,
  RenderRequest,
  RouteModule,
} from '@/core'

import { render as createRenderer } from '@/render'

type Promisable<T> = T | PromiseLike<T>

/**
 * Hook into the rendering process that generates HTML for a page.
 *
 * Return nothing to defer to the next renderer.
 */
export function render<
  Route extends string,
  Module extends object = RouteModule,
  Props extends object = CommonClientProps
>(
  route: Route,
  render: (
    module: Module,
    request: RenderRequest<Props, InferRouteParams<Route>>
  ) => Promisable<string | null | void>
): RenderCall<string>

/** Set the fallback renderer. */
export function render<
  Module extends object = RouteModule,
  Props extends object = CommonClientProps
>(
  render: (module: Module, request: RenderRequest<Props>) => Promisable<string>
): RenderCall<string>

export function render(...args: [any, ...any[]]) {
  if (typeof args[0] !== 'string') {
    args.unshift('')
  }
  const [route, render, start] = args
  const renderer = createRenderer<string>(
    route,
    render,
    s => s,
    undefined,
    start
  )
  return renderer.api
}
