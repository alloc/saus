import { httpMethods } from '@utils/httpMethods'
import { OneOrMany, Remap } from '@utils/types'
import http, { Agent } from 'http'
import { CamelCase, Promisable } from 'type-fest'
import type { Endpoint } from '../endpoint'
import { HttpRedirect } from './redirect'
import { HttpResponse } from './response'

export type { BufferLike } from '../app/types'

export const URL = (globalThis as any).URL as typeof import('url').URL
export type URL = import('url').URL

export namespace Http {
  export type Method = typeof httpMethods[number]

  export interface Options {
    agent?: Agent | boolean | undefined
    /**
     * If the response has a status code *not* between 200 and 399,
     * resolve the promise normally instead of rejecting it.
     */
    allowBadStatus?: boolean
    auth?: string
    beforeSend?: (req: Options, body?: Endpoint.AnyBody) => void
    hash: string
    headers?: RequestHeaders
    hostname: string
    href: string
    method?: string
    path: string
    pathname: string
    port?: number | string
    protocol: string
    search: string
    signal?: AbortSignal | undefined
    /**
     * Instead of buffering the response data into memory, this
     * function will be called with the response object.
     */
    sink?: (resp: http.IncomingMessage) => void
    timeout?: number | undefined
  }

  export const Response = HttpResponse
  export const Redirect = HttpRedirect

  export type Response = HttpResponse
  export type Redirect = HttpRedirect

  export type RequestHook = (
    req: Http.Options,
    body?: Endpoint.Body
  ) => Promisable<HttpResponse | void>

  export type ResponseHook = (
    req: Readonly<Http.Options>,
    res: HttpResponse
  ) => Promisable<void>

  export type Headers = RequestHeaders | ResponseHeaders

  export type RequestHeaders = Partial<CommonRequestHeaders> &
    Record<string, string | string[] | undefined>

  export type ResponseHeaders = Partial<CommonResponseHeaders> &
    Record<string, string | string[] | undefined>

  export interface CommonHeaders
    extends CommonRequestHeaders,
      CommonResponseHeaders {}

  export interface CommonRequestHeaders {
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept */
    accept: string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Charset */
    'accept-charset': string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding */
    'accept-encoding': string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language */
    'accept-language': string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization */
    authorization: string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cookie */
    cookie: string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Match */
    'if-match': string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since */
    'if-modified-since': string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match */
    'if-none-match': string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Unmodified-Since */
    'if-unmodified-since': string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin */
    origin: string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referer */
    referer: string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent */
    'user-agent': string
  }

  export interface CommonResponseHeaders {
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control */
    'cache-control': string
    /** @link https://developers.cloudflare.com/cache/about/cdn-cache-control */
    'cdn-cache-control': string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding */
    'content-encoding': string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Language */
    'content-language': string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Length */
    'content-length': string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type */
    'content-type': string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag */
    etag: string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expires */
    expires: string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified */
    'last-modified': string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Link */
    link: string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location */
    location: string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie */
    'set-cookie': string | string[]
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Transfer-Encoding */
    'transfer-encoding': string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary */
    vary: string
  }

  export type CacheControl = OneOrMany<CacheControlFlag | CacheControlOptions>

  export type CacheControlFlag =
    | 'immutable'
    | 'max-stale'
    | 'must-revalidate'
    | 'no-cache'
    | 'no-store'
    | 'no-transform'
    | 'private'
    | 'proxy-revalidate'
    | 'public'

  export type CacheControlOptions = Remap<
    {
      maxAge?: number
      minFresh?: number
      sMaxAge?: number
      staleIfError?: number
      staleWhileRevalidate?: number
    } & {
      [P in CamelCase<CacheControlFlag>]?: boolean
    }
  >

  export interface ContentHeaders {
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding */
    encoding?: string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Length */
    length?: number | string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type */
    type?: string
  }

  export interface AccessControlHeaders {
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials */
    allowCredentials?: boolean
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Headers */
    allowHeaders?: '*' | string[]
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Methods */
    allowMethods?: '*' | string[]
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin */
    allowOrigin?: string
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers */
    exposeHeaders?: string[]
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age */
    maxAge?: number | string
  }
}
