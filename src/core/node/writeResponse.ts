import type { ServerResponse } from 'http'
import type { Endpoint } from '../endpoint'
import { DeclaredHeaders, Headers } from '../http/headers'
import { normalizeHeaders } from '../http/normalizeHeaders'
import { writeBody } from './writeBody'
import { writeHeaders } from './writeHeaders'

export function writeResponse(
  res: ServerResponse,
  status: number,
  headers?: Headers | DeclaredHeaders | null,
  body?: Endpoint.AnyBody
) {
  if (headers) {
    if (headers instanceof DeclaredHeaders) {
      headers = headers.toJSON()
    }
    if (body?.mime) {
      headers = {
        ...normalizeHeaders(headers),
        'content-type': body.mime,
      }
    }
    if (headers) {
      writeHeaders(res, headers)
    }
  }
  res.writeHead(status)
  if (body) {
    writeBody(res, body)
  } else {
    res.end()
  }
}
