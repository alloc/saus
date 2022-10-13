import { Endpoint } from '@runtime/endpoint'
import { unwrapBuffer } from '@utils/buffer'

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
