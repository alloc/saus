import http, { Agent } from 'http'
import type { Endpoint } from '../endpoint'
import { httpMethods } from '../utils/httpMethods'
import type { RequestHeaders } from './headers'

export type { BufferLike } from '../app/types'

export type HttpMethod = typeof httpMethods[number]

export interface HttpOptions {
  agent?: Agent | boolean | undefined
  /**
   * If the response has a status code *not* between 200 and 399,
   * resolve the promise normally instead of rejecting it.
   */
  allowBadStatus?: boolean
  auth?: string
  beforeSend?: (req: HttpOptions, body?: Endpoint.AnyBody) => void
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

export const URL = (globalThis as any).URL as typeof import('url').URL
export type URL = import('url').URL
