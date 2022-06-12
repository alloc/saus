import http, { Agent } from 'http'
import { httpMethods } from '../utils/httpMethods'
import type { Headers } from './response'

export type { BufferLike } from '../app/types'

export type HttpMethod = typeof httpMethods[number]

export interface HttpOptions {
  agent?: Agent | boolean | undefined
  /**
   * If the response has a status code *not* between 200 and 399,
   * resolve the promise normally instead of rejecting it.
   */
  allowBadStatus?: boolean
  hash?: string
  headers?: Headers
  href?: string
  method?: string
  pathname?: string
  protocol?: string
  search?: string
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
