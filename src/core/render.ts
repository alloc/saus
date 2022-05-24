import { parseRoutePath } from '../utils/parseRoutePath'
import type { ClientDescription } from './client'
import { renderModule } from './global'
import { DocumentHook, Renderer, RenderRequest } from './renderer'
import { matchRoute, RouteParams } from './routes'

type Promisable<T> = T | PromiseLike<T>

/**
 * Values configurable from the `saus.render` module defined in
 * your Vite config.
 */
export type RenderModule = {
  /** Hooks that run before the renderer */
  beforeRenderHooks: BeforeRenderHook[]
  /** The renderers for specific routes */
  renderers: Renderer[]
  /** The renderer used when no route is matched */
  defaultRenderer?: Renderer
}

export type BeforeRenderHook = {
  (request: RenderRequest<any, any>): Promisable<void>
  match?: (path: string) => RouteParams | undefined
  start?: number
}

export type RenderHook<T = any> = (
  module: any,
  request: RenderRequest<any, any>
) => Promisable<T>

type ToString<T> = (result: T) => Promisable<string>

/**
 * Create a `Renderer` and add it to the current Saus context.
 *
 * To define the fallback renderer, the `route` argument should
 * be an empty string.
 *
 * The `stringify` function should never prepend a doctype.
 */
export function render<T>(
  route: string,
  getBody: RenderHook<T | null | void>,
  stringify: ToString<T> | { head: ToString<T>; body: ToString<T> } = String,
  onDocument: DocumentHook | undefined,
  clientDescription?: ClientDescription,
  start?: number
): Renderer<T> {
  const renderer = new Renderer(
    route,
    getBody,
    typeof stringify == 'function' ? stringify : stringify.body,
    typeof stringify == 'function' ? stringify : stringify.head,
    onDocument,
    clientDescription,
    start
  )
  if (route) {
    renderModule.renderers.push(renderer)
  } else {
    renderModule.defaultRenderer = renderer
  }
  return renderer
}

/** Run a before-render effect for every route */
export function beforeRender(hook: BeforeRenderHook): void

/** Run a before-render effect for the given `route` */
export function beforeRender(route: string, hook: BeforeRenderHook): void

export function beforeRender(...args: any[]) {
  let hook: BeforeRenderHook
  if (typeof args[0] == 'string') {
    const route = args[0]
    hook = args[1]
    const parsedRoute = parseRoutePath(route)
    hook.match = path => matchRoute(path, parsedRoute)
  } else {
    hook = args[0]
  }
  if (typeof args[args.length - 1] === 'number') {
    hook.start = args.pop() as number
  }
  renderModule.beforeRenderHooks.push(hook)
}
