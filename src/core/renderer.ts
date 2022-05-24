import type { BufferLike } from '../app/types'
import type { RouteModule } from '../client'
import { parseRoutePath } from '../utils/parseRoutePath'
import type { ClientDescription, CommonClientProps } from './client'
import type { RuntimeConfig } from './config'
import type { RouteParams } from './routes'

type Promisable<T> = T | PromiseLike<T>

export interface RenderRequest<
  Props extends {} = Record<string, any>,
  Params extends {} = RouteParams
> {
  /** The pathname from the URL (eg: `/a?b=1` → `"/a"`) */
  path: string
  /** The `.html` file associated with this page */
  file: string
  /** The search query from the URL (eg: `/a?b=1` → `"b=1"`) */
  query?: string
  /** The entry module imported by the route */
  module: RouteModule
  /** Page props provided by the route */
  props: Props & CommonClientProps
  /** Named strings extracted with a route pattern */
  params: Params
}

export type DocumentHook = (
  this: RenderApi,
  html: string,
  request: RenderRequest,
  config: RuntimeConfig
) => Promisable<void>

export type RenderApi = {
  emitFile(id: string, mime: string, data: BufferLike): void
}

const emitPage: DocumentHook = function (html, { file }) {
  this.emitFile(file, 'text/html', html)
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
    readonly onDocument: DocumentHook = emitPage,
    readonly client?: ClientDescription,
    readonly start?: number
  ) {
    if (route) {
      const regex = parseRoutePath(route).pattern
      this.test = regex.test.bind(regex)
    } else {
      this.test = () => true
    }
  }

  async renderDocument(request: RenderRequest, headProps?: any) {
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
        const headRequest = headProps
          ? { ...request, props: { ...request.props, ...headProps } }
          : request

        let head = await this.stringifyHead(await this.getHead(headRequest))
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
  head<Props extends {} = Record<string, any>>(
    getHead: (request: RenderRequest<Props>) => T | Promise<T>
  ) {
    this._renderer.getHead = getHead as any
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
