import { Endpoint } from '../endpoint'
import { unwrapBuffer } from '../node/buffer'

export function unwrapBody(body: Endpoint.AnyBody) {
  return body.stream
    ? body.stream
    : body.buffer
    ? unwrapBuffer(body.buffer)
    : body.text !== undefined
    ? body.text
    : body.json !== undefined
    ? JSON.stringify(body.json)
    : undefined
}
