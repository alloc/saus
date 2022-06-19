import { Endpoint } from '../core'
import { noop } from '../utils/noop'
import { Response } from './response'
import { HttpOptions } from './types'

export const requestHook = { current: noop as RequestHook }
export const responseHook = { current: noop as ResponseHook }

type Promisable<T> = T | PromiseLike<T>

export type RequestHook = (
  req: HttpOptions,
  body?: Endpoint.Body
) => Promisable<Response | void>

export type ResponseHook = (
  req: Readonly<HttpOptions>,
  res: Response
) => Promisable<void>

/**
 * Intercept a request before it's been sent. Optionally return a `Response` object.
 * This hook is not called if a matching response is found in the local cache.
 */
export function setRequestHook(onRequest: RequestHook) {
  requestHook.current = onRequest
}

/**
 * Intercept a response before it's cached and used. The response headers can be
 * mutated (eg: to increase the `max-age` in the `Cache-Control` header).
 */
export function setResponseHook(onResponse: ResponseHook) {
  responseHook.current = onResponse
}
