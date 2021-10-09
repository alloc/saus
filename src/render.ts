import {
  render as createRenderer,
  ClientState,
  InferRouteParams,
  RenderCall,
  RenderRequest,
  RouteModule,
} from './core'

type Promisable<T> = T | PromiseLike<T>

/**
 * Hook into the rendering process that generates HTML for a page.
 *
 * Return nothing to defer to the next renderer.
 */
export function render<
  Route extends string,
  Module extends object = RouteModule,
  State extends object = ClientState
>(
  route: Route,
  render: (
    module: Module,
    request: RenderRequest<State, InferRouteParams<Route>>
  ) => Promisable<string | null | void>
): RenderCall<string>

/** Set the fallback renderer. */
export function render<
  Module extends object = RouteModule,
  State extends object = ClientState
>(
  render: (module: Module, request: RenderRequest<State>) => Promisable<string>
): RenderCall<string>

export function render(...args: [any, ...any[]]) {
  if (typeof args[0] !== 'string') {
    args.unshift('')
  }
  const [route, render, hash, start] = args
  const renderer = createRenderer<string>(
    route,
    render,
    s => s,
    undefined,
    hash,
    start
  )
  return renderer.api
}
