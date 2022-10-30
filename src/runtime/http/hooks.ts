import { noop } from '@utils/noop'
import { Http } from './types'

export const requestHook = { current: noop as Http.RequestHook }
export const responseHook = { current: noop as Http.ResponseHook }

/**
 * Intercept a request before it's been sent. Optionally return a `Response` object.
 * This hook is not called if a matching response is found in the local cache.
 */
export function setRequestHook(onRequest: Http.RequestHook) {
  requestHook.current = onRequest
}

/**
 * Intercept a response before it's cached and used. The response headers can be
 * mutated (eg: to increase the `max-age` in the `Cache-Control` header).
 */
export function setResponseHook(onResponse: Http.ResponseHook) {
  responseHook.current = onResponse
}
