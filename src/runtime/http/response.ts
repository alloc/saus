import type { Buffer } from '@utils/buffer'
import { normalizeHeaders } from './normalizeHeaders'
import { Http } from './types'

/**
 * An HTTP response received from the server.
 */
export class HttpResponse {
  readonly headers: Http.ResponseHeaders
  readonly ok: boolean

  constructor(
    readonly data: Buffer,
    readonly status: number,
    headers: Http.ResponseHeaders
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
