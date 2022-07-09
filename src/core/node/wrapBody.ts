import { Buffer } from '../client/buffer'
import { Endpoint, isStream, isWebStream } from '../endpoint'

export function wrapBody<T>(body: T): ToBody<T>
export function wrapBody(body: any): Endpoint.Body | undefined
export function wrapBody(body: any): Endpoint.Body | undefined {
  return body === undefined
    ? undefined
    : typeof body == 'string'
    ? { text: body }
    : body instanceof Buffer
    ? { buffer: body }
    : isStream(body)
    ? { stream: body }
    : isWebStream(body)
    ? { webStream: body }
    : { json: body }
}

type ToBody<T> = T extends undefined
  ? undefined
  : T extends string
  ? { text: string }
  : T extends Buffer
  ? { buffer: Buffer }
  : T extends Endpoint.Stream
  ? { stream: Endpoint.Stream }
  : T extends Endpoint.WebStream
  ? { webStream: Endpoint.WebStream }
  : { json: T }
