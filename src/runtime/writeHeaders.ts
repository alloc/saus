import type { ServerResponse } from 'http'
import type { Headers } from '../http/headers'

export function writeHeaders(res: ServerResponse, headers: Headers) {
  for (const name in headers) {
    const value = headers[name]
    if (value !== undefined) {
      res.setHeader(name, value)
    }
  }
}
