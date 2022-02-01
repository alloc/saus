import type { Buffer } from '../client/buffer'

export type Headers = Record<string, string | string[] | undefined>

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
