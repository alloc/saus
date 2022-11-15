import type { ServerResponse } from 'http'
import { DeclaredHeaders } from './headers'
import { normalizeHeaders } from './normalizeHeaders'
import { Http } from './types'
import { AnyBody, writeBody } from './writeBody'
import { writeHeaders } from './writeHeaders'

export function writeResponse(
  res: ServerResponse,
  status: number,
  headers?: Http.ResponseHeaders | DeclaredHeaders | null,
  body?: AnyBody
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
