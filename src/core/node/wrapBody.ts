import { Buffer } from '../client/buffer'
import { Endpoint } from '../endpoint'

export function wrapBody<T>(body: T): ToBody<T>
export function wrapBody(body: any): Endpoint.Body | undefined
export function wrapBody(body: any): Endpoint.Body | undefined {
  return body === undefined
    ? undefined
    : typeof body == 'string'
    ? { text: body }
    : body instanceof Buffer
    ? { buffer: body }
    : globalThis.Buffer.isBuffer(body)
    ? { buffer: Buffer.from(body.buffer) }
    : isReadableStream(body)
    ? { stream: body }
    : { json: body }
}

type ToBody<T> = T extends undefined
  ? undefined
  : T extends string
  ? { text: string }
  : T extends Buffer
  ? { buffer: Buffer }
  : T extends NodeJS.ReadableStream
  ? { stream: NodeJS.ReadableStream }
  : { json: T }

function isReadableStream(stream: any): stream is NodeJS.ReadableStream {
  return (
    isStream(stream) &&
    (stream as any).readable !== false &&
    typeof (stream as any).read === 'function'
  )
}

function isStream(stream: any): stream is { pipe: Function } {
  return (
    stream !== null &&
    typeof stream === 'object' &&
    typeof stream.pipe === 'function'
  )
}
