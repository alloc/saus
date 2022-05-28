import type { Buffer } from '../client/buffer'

export interface CommonHeaders {
  'cache-control'?: string
  'content-length'?: string
  'content-type'?: string
}

export type Headers = CommonHeaders &
  Record<string, string | string[] | undefined>

export class Response {
  constructor(
    readonly data: Buffer,
    readonly status: number,
    readonly headers: Headers
  ) {}

  toString(encoding?: string) {
    return this.data.toString(encoding)
  }

  toJSON<T = any>(): T {
    return JSON.parse(this.toString())
  }
}
