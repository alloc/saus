import http from 'http'
import { httpMethods } from '../utils/httpMethods'

export { BufferLike } from '../app/types'

export type HttpMethod = typeof httpMethods[number]

export interface HttpOptions extends http.RequestOptions {
  hash?: string
  search?: string
  pathname?: string
  href?: string
  /**
   * If the response has a status code *not* between 200 and 399,
   * resolve the promise normally instead of rejecting it.
   */
  allowBadStatus?: boolean
  /**
   * Instead of buffering the response data into memory, this
   * function will be called with the response object.
   */
  sink?: (resp: http.IncomingMessage) => void
}

export const URL = (globalThis as any).URL as typeof import('url').URL
export type URL = import('url').URL
