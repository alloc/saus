import type { Buffer } from '../client/buffer'
import { normalizeHeaders } from './normalizeHeaders'

export interface CommonHeaders {
  'cache-control'?: string
  'content-length'?: string
  'content-type'?: string
  expires?: string
}

export type Headers = CommonHeaders &
  Record<string, string | string[] | undefined>

export class Response {
  readonly headers: Headers

  constructor(
    readonly data: Buffer,
    readonly status: number,
    headers: Headers
  ) {
    this.headers = normalizeHeaders(headers)
  }

  toString(encoding?: string) {
    return this.data.toString(encoding)
  }

  toJSON<T = any>(): T {
    return JSON.parse(this.toString())
  }
}
