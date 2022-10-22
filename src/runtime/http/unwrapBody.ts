import { unwrapBuffer } from '@utils/node/buffer'
import { AnyBody } from './writeBody'

export function unwrapBody(body: AnyBody) {
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
