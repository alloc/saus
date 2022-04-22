import type { App } from '../app/createApp'
import type { Buffer } from '../client'
import type { Headers, HttpRedirect, Response } from '../http'
import { assignDefaults } from '../utils/assignDefaults'
import type { Falsy, Promisable } from '../utils/types'
import type { ParsedUrl } from '../utils/url'
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
    StaticRequest<RouteParams> &
    Omit<RouteParams, keyof StaticRequest>

  export type RequestUrl<RouteParams extends {} = {}> = unknown &
    StaticRequestUrl<RouteParams> &
    Omit<RouteParams, keyof StaticRequest>

  export interface StaticRequest<
    RouteParams extends {} = Record<string, string>
  > extends StaticRequestUrl<RouteParams> {
    respondWith(...response: ResponseTuple): void
  }

  export interface StaticRequestUrl<
    RouteParams extends {} = Record<string, string>
  > extends ParsedUrl<RouteParams> {
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

export function makeRequestUrl<Params extends {}>(
  url: ParsedUrl<Params>,
  method: string,
  headers: Headers
): Endpoint.RequestUrl<Params> {
  const requestUrl = url as ParsedUrl<Params> & {
    method: typeof method
    headers: typeof headers
  }
  requestUrl.method = method
  requestUrl.headers = headers
  return assignDefaults<any>(requestUrl, url.routeParams)
}

export function isRequestUrl<T extends {} = any>(
  arg: ParsedUrl
): arg is Endpoint.RequestUrl<T> {
  return Boolean(arg && 'method' in arg)
}

export function makeRequest(
  url: Endpoint.RequestUrl,
  respondWith: (...response: Endpoint.ResponseTuple) => void
): Endpoint.StaticRequest {
  const request = url as Endpoint.RequestUrl & {
    respondWith: typeof respondWith
  }
  request.respondWith = respondWith
  return request
}
