import type { ServerResponse } from 'http'
import type { Endpoint } from '../endpoint'
import type { DeclaredHeaders, Headers } from '../http/headers'
import { writeBody } from './writeBody'
import { writeHeaders } from './writeHeaders'

export function writeResponse(
  res: ServerResponse,
  status: number,
  headers?: Headers | DeclaredHeaders | null,
  body?: Endpoint.Body
) {
  if (headers) {
    headers =
      typeof headers.toJSON == 'function'
        ? headers.toJSON()
        : (headers as Headers)
  }
  if (headers) {
    writeHeaders(res, headers)
  }
  res.writeHead(status)
  if (body) {
    writeBody(res, body)
  } else {
    res.end()
  }
}
