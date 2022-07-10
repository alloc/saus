import { Simplify, UnionToIntersection } from 'type-fest'
import type { App } from './app/types'
import type { Buffer } from './client/buffer'
import type {
  DeclaredHeaders,
  HttpRedirect,
  RequestHeaders,
  Response as HttpResponse,
  ResponseHeaders,
} from './http'
import type { ParsedUrl } from './node/url'
import type { InferRouteParams, Route, RouteParams } from './routes'
import type { httpMethods } from './utils/httpMethods'
import type { AnyToObject, Falsy, Promisable } from './utils/types'

export interface Endpoint<Params extends object = any>
  extends Endpoint.Function<AnyToObject<Params, RouteParams>> {
  /** This function responds to this HTTP method. */
  method: string
  /** This function responds to these MIME type requests. */
  contentTypes: Endpoint.ContentType[]
}

export type EndpointConfig<Params extends object = any> = {
  run: Endpoint.Function<Params>
} & Partial<Endpoint<Params>>

/** Used by `App.Plugin`s that override `getEndpoints` */
export const defineEndpoint = //
  <Params extends object = any>({ run, ...props }: EndpointConfig<Params>) =>
    Object.assign(run, props) as Endpoint.Generated

export namespace Endpoint {
  export type Generated = Function<RouteParams> & Partial<Endpoint>
  export type Generator = (
    method: string,
    route: Route
  ) => Generated | (Generated | Falsy)[] | Falsy

  export type ContentType = `${string}/${string}`
  export type ContentTypes = [ContentType, ...ContentType[]]

  export type Declarators<Self, Params extends {} = {}> = {
    [T in typeof httpMethods[number]]: {
      /** Declare an endpoint that responds to any `Accept` header */
      (fn: Function<Params>): Self

      /** Declare an endpoint that responds to specific `Accept` headers */
      (contentTypes: ContentTypes, fn: Function<Params>): Self

      /** Declare a JSON endpoint */
      <RoutePath extends string>(
        nestedPath: `${RoutePath}.json`,
        fn: JsonFunction<Params & InferRouteParams<RoutePath>>
      ): Self

      <RoutePath extends string>(
        nestedPath: RoutePath,
        contentTypes: ContentTypes,
        fn: Function<Params & InferRouteParams<RoutePath>>
      ): Self
    }
  }

  export type Result = HttpResponse | HttpRedirect | null | void

  /**
   * Endpoints ending in `.json` don't have to wrap their
   * response data. Just return a JSON-compatible value
   * or a promise that resolves with one. If the result
   * is undefined, the next endpoint handler is tried.
   */
  export type JsonFunction<Params extends {} = {}> = (
    request: Request<Params>,
    responseHeaders: DeclaredHeaders,
    app: App
  ) => Promisable<any>

  export type Function<Params extends object = any> = (
    request: Request<Params>,
    responseHeaders: DeclaredHeaders,
    app: App
  ) => Promisable<Result>

  export type Request<Params extends object = any> = unknown &
    RequestUrl<Params> &
    RequestMethods &
    AnyToObject<
      Omit<Params, keyof RequestMethods | keyof RequestUrl>,
      RouteParams
    >

  interface RequestMethods {
    respondWith: RespondWith
    promise: () => RespondWith
  }

  export interface ResponseStream extends NodeJS.ReadableStream {
    statusCode?: number
    headers?: ResponseHeaders
  }

  export type ResponsePromise = Promise<ResponseTuple | [ResponseStream] | null>

  export interface RespondWith {
    (...response: ResponseTuple): void
    (response: ResponseTuple): void
    (response: ResponseStream): void
    (promise: ResponsePromise): void
  }

  export interface RequestUrl<Params extends object = any>
    extends ParsedUrl<Params> {
    readonly method: string
    readonly headers: Readonly<RequestHeaders>
    readonly read: () => Promise<Buffer>
    readonly json: <T = any>() => Promise<T>
    /**
     * The platform-specific request object related to this URL. \
     * For example, it's an `IncomingMessage` instance when using a
     * basic Node.js server.
     */
    object?: any
  }

  export interface RequestHook extends Function {
    priority?: number
  }

  export interface ResponseHook {
    (
      request: Request<Record<string, string>>,
      response: Response,
      app: App
    ): Promisable<void>
    priority?: number
  }

  export type Response = {
    ok: boolean
    route?: Route
    status: number
    headers: DeclaredHeaders<ResponseHeaders | null>
    body?: AnyBody
  }

  export type ResponseTuple = [
    status?: number,
    body?: Body & { headers?: ResponseHeaders | null }
  ]

  export type Body =
    | { buffer: Buffer }
    | { stream: NodeJS.ReadableStream }
    | { text: string; mime?: string }
    | { json?: any }

  export type AnyBody = Simplify<Partial<UnionToIntersection<Body>>>
}
