import type { App } from '../app/createApp'
import type { Buffer } from '../client'
import type { Headers, HttpRedirect, Response } from '../http'
import { assignDefaults } from '../utils/assignDefaults'
import type { Falsy, Promisable } from '../utils/types'
import type { ParsedUrl } from '../utils/url'
import type { Route } from './routes'

export const httpMethods = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
] as const

export interface Endpoint extends Endpoint.Function {
  /** This function responds to this HTTP method. */
  method: string
  /** This function responds to these MIME type requests. */
  contentTypes: Endpoint.ContentType[]
}

export namespace Endpoint {
  export type Generated = Function & Partial<Endpoint>

  export type Generator = (
    method: string,
    route: Route,
    app: App
  ) => Generated | (Generated | Falsy)[] | Falsy

  export type ContentType = `${string}/${string}`
  export type ContentTypes = [ContentType, ...ContentType[]]

  export type Declarators<U> = {
    [T in typeof httpMethods[number]]: {
      (fn: Function): U
      (nestedPath: `${string}.json`, fn: JsonFunction): U
      (contentTypes: ContentTypes, fn: Function): U
      (nestedPath: string, contentTypes: ContentTypes, fn: Function): U
    }
  }

  export type Result = Response | HttpRedirect | null | void

  /**
   * Endpoints ending in `.json` don't have to wrap their
   * response data. Just return a JSON-compatible value
   * or a promise that resolves with one. If the result
   * is undefined, the next endpoint handler is tried.
   */
  export type JsonFunction = (request: StaticRequest) => Promisable<any>
  export type Function = (request: StaticRequest) => Promisable<Result>

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

  export type ResponseTuple = [
    status: number,
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
