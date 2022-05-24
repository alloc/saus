import type { ServerResponse } from 'http'
import type { Endpoint } from '../core/endpoint'
import type { Headers } from '../http'
import { writeBody } from './writeBody'

export function writeResponse(
  res: ServerResponse,
  status: number,
  headers?: Headers | null,
  body?: Endpoint.ResponseBody
) {
  if (headers) {
    for (const name in headers) {
      res.setHeader(name, headers[name]!)
    }
  }
  res.writeHead(status)
  if (body) {
    writeBody(res, body)
  } else {
    res.end()
  }
}
