import type { ClientProvider, ClientState } from './client'
import { RegexParam, RouteParams } from './routes'

type Promisable<T> = T | PromiseLike<T>

export type RenderRequest<
  State extends object = ClientState,
  Params extends RouteParams = RouteParams
> = {
  path: string
  query?: string
  state: State
  params: Params
}

const noop = () => {}

export class Renderer<T = any> {
  api = new RenderCall<T>(this)
  test: (path: string) => boolean
  getHead?: (request: RenderRequest) => Promisable<T>

  constructor(
    route: string,
    readonly render: (
      module: object,
      request: RenderRequest,
      renderer: Renderer
    ) => Promisable<string | null | void>,
    readonly getClient?: ClientProvider,
    readonly start?: number
  ) {
    if (route) {
      const regex = RegexParam.parse(route).pattern
      this.test = regex.test.bind(regex)
    } else {
      this.test = () => true
    }
  }

  /**
   * Trigger the post-render effect (if one exists). This should be
   * called *immediately* after the HTML string is returned. We
   * recommend using a try-finally block.
   */
  didRender: () => Promise<void> | void = noop
}

/**
 * The public API returned by `render` call.
 *
 * It lets the user define an optional `<head>` element
 * and/or post-render isomorphic side effect.
 */
export class RenderCall<T = string | null | void> {
  constructor(protected _renderer: Renderer<T>) {}

  /**
   * Render the `<head>` subtree of the HTML document. The given render
   * function only runs in an SSR environment, and it's invoked after
   * the `<body>` is pre-rendered.
   */
  head(renderHead: (request: RenderRequest) => T | Promise<T>) {
    this._renderer.getHead = renderHead
    return this
  }

  /**
   * Run an isomorphic function after render. In SSR, it runs after the
   * HTML string is rendered. On the client, it runs post-hydration.
   */
  then(didRender: () => Promise<void> | void) {
    this._renderer.didRender = didRender
  }
}
