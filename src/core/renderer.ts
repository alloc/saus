import type { RouteModule } from '../client'
import type { ClientDescription, ClientState } from './client'
import { RegexParam, RouteParams } from './routes'

type Promisable<T> = T | PromiseLike<T>

export type RenderRequest<
  State extends object = ClientState,
  Params extends RouteParams = RouteParams
> = {
  path: string
  query?: string
  module: RouteModule
  state: State
  params: Params
}

export class Renderer<T = any> {
  api = new RenderCall<T>(this)
  test: (path: string) => boolean
  getHead?: (request: RenderRequest) => Promisable<T>
  didRender?: (request: RenderRequest) => Promisable<void>

  constructor(
    route: string,
    readonly getBody: (
      module: RouteModule,
      request: RenderRequest
    ) => Promisable<T | null | void>,
    readonly stringifyBody: (body: T) => Promisable<string>,
    readonly stringifyHead: (head: T) => Promisable<string>,
    readonly client?: ClientDescription,
    readonly start?: number
  ) {
    if (route) {
      const regex = RegexParam.parse(route).pattern
      this.test = regex.test.bind(regex)
    } else {
      this.test = () => true
    }
  }

  async renderDocument(request: RenderRequest) {
    const body = await this.getBody(request.module, request)
    if (body == null) {
      return null
    }
    try {
      let html = await this.stringifyBody(body)
      if (!/^\s*<body( |>)/.test(html)) {
        html = `<body>\n${html}\n</body>`
      }
      if (this.getHead) {
        let head = await this.stringifyHead(await this.getHead(request))
        if (!/^\s*<head( |>)/.test(head)) {
          head = `<head>\n${head}\n</head>`
        }
        html = head + html
      }
      if (!/^\s*<html( |>)/.test(html)) {
        html = `<html>${html}</html>`
      }
      return `<!DOCTYPE html>\n` + html
    } finally {
      if (this.didRender) {
        await this.didRender(request)
      }
    }
  }
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
  head(getHead: (request: RenderRequest) => T | Promise<T>) {
    this._renderer.getHead = getHead
    return this
  }

  /**
   * Run an isomorphic function after render. In SSR, it runs after the
   * HTML string is rendered. On the client, it runs post-hydration.
   */
  then(didRender: (request: RenderRequest) => Promisable<void>) {
    this._renderer.didRender = didRender
  }
}
