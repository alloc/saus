import type { Buffer } from '../client/buffer'
import type { ResponseHeaders } from './headers'
import { normalizeHeaders } from './normalizeHeaders'

export class Response {
  readonly headers: ResponseHeaders
  readonly ok: boolean

  constructor(
    readonly data: Buffer,
    readonly status: number,
    headers: ResponseHeaders
  ) {
    this.headers = normalizeHeaders(headers)
    this.ok = status >= 200 && status < 400
  }

  toString(encoding?: string) {
    return this.data.toString(encoding)
  }

  toJSON<T = any>(): T {
    return JSON.parse(this.toString())
  }
}
