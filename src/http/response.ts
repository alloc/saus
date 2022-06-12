import type { Buffer } from '../client/buffer'
import type { Headers } from './headers'
import { normalizeHeaders } from './normalizeHeaders'

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
