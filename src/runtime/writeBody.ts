import { Endpoint } from '../core'
import { unwrapBuffer } from '../core/buffer'

export function writeBody(res: NodeJS.WritableStream, body: Endpoint.AnyBody) {
  if (body.stream) {
    body.stream.pipe(res, { end: true })
  } else {
    const rawBody = toRawBody(body)
    if (rawBody !== null) {
      res.write(rawBody)
    }
    res.end()
  }
}

export function toRawBody(body: Endpoint.AnyBody) {
  return body.buffer
    ? unwrapBuffer(body.buffer)
    : body.text !== undefined
    ? body.text
    : body.json !== undefined
    ? JSON.stringify(body.json)
    : null
}
