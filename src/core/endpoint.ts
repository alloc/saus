import type { App } from '../app/createApp'
import type { Buffer } from '../client'
import type { Headers, HttpRedirect, Response } from '../http'
import { assignDefaults } from '../utils/assignDefaults'
import type { Falsy, Promisable } from '../utils/types'
import { ParsedUrl } from '../utils/url'
import type { InferRouteParams, Route, RouteParams } from './routes'

export const httpMethods = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
] as const

export interface Endpoint<Params extends {} = {}>
  extends Endpoint.Function<Params> {
  /** This function responds to this HTTP method. */
  method: string
  /** This function responds to these MIME type requests. */
  contentTypes: Endpoint.ContentType[]
}

export namespace Endpoint {
  export type Generated = Function<RouteParams> & Partial<Endpoint>

  export type Generator = (
    method: string,
    route: Route,
    app: App
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

  export type Result = Response | HttpRedirect | null | void

  /**
   * Endpoints ending in `.json` don't have to wrap their
   * response data. Just return a JSON-compatible value
   * or a promise that resolves with one. If the result
   * is undefined, the next endpoint handler is tried.
   */
  export type JsonFunction<Params extends {} = {}> = (
    request: Request<Params>
  ) => Promisable<any>

  export type Function<Params extends {} = {}> = (
    request: Request<Params>
  ) => Promisable<Result>

  export type Request<RouteParams extends {} = {}> = unknown &
    RequestUrl<RouteParams> &
    RequestMethods &
    Omit<RouteParams, keyof RequestMethods | keyof RequestUrl>

  interface RequestMethods {
    respondWith(...response: ResponseTuple): void
  }

  export interface RequestUrl<RouteParams extends {} = Record<string, string>>
    extends ParsedUrl<RouteParams> {
    readonly method: string
    readonly headers: Headers
  }

  export type ResponseHook = (
    request: Request,
    response: ResponseTuple
  ) => Promisable<void>

  export type ResponseTuple = [
    status?: number,
    headers?: Headers | null,
    body?: Endpoint.ResponseBody
  ]

  export type ResponseBody =
    | { buffer: Buffer }
    | { stream: NodeJS.ReadableStream }
    | { text: string }
    | { json: any }
    | {}
}

/**
 * Attach `method` and `headers` properties to the given URL.
 */
export function makeRequestUrl<Params extends {}>(
  url: ParsedUrl<Params>,
  method: string,
  headers: Headers
): Endpoint.RequestUrl<Params> {
  if (isRequestUrl(url)) {
    return url
  }
  const requestUrl = url as ParsedUrl<Params> & {
    method: typeof method
    headers: typeof headers
  }
  requestUrl.method = method
  requestUrl.headers = headers
  return requestUrl
}

function isRequestUrl<T extends {} = any>(
  arg: ParsedUrl
): arg is Endpoint.RequestUrl<T> {
  return 'method' in arg
}

/**
 * Convert the given `url` into a Saus request.
 */
export function makeRequest<Params extends {}>(
  url: Endpoint.RequestUrl<Params>,
  respondWith: (...response: Endpoint.ResponseTuple) => void
): Endpoint.Request<Params> {
  const request = Object.assign(
    Object.create(ParsedUrl.prototype),
    url
  ) as Endpoint.Request<Params>
  request.respondWith = respondWith
  return assignDefaults<any>(request, url.routeParams)
}
