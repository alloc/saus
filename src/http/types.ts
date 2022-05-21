import http from 'http'
import { httpMethods } from '../utils/httpMethods'

export { BufferLike } from '../app/types'

export type HttpMethod = typeof httpMethods[number]

export interface HttpOptions extends http.RequestOptions {
  hash?: string
  search?: string
  pathname?: string
  href?: string
}

export const URL = (globalThis as any).URL as typeof import('url').URL
export type URL = import('url').URL
