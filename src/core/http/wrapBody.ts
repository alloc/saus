import { Endpoint } from '../endpoint'
import { Buffer, unwrapBuffer } from '../node/buffer'

export function wrapBody<T>(body: T): ToBody<T>
export function wrapBody(body: any): Endpoint.Body | undefined
export function wrapBody(body: any): Endpoint.Body | undefined {
  return body === undefined
    ? undefined
    : typeof body == 'string'
    ? { text: body }
    : Buffer.isBuffer(body)
    ? { buffer: unwrapBuffer(body) }
    : isReadableStream(body)
    ? { stream: body }
    : {
        // Serialize to JSON string immediately, so we can validate
        // any nested objects before sending a request/response.
        mime: 'application/json',
        text: JSON.stringify(body, (_, value) => {
          // Catch accidental serialization of classical objects.
          if (isJsonReady(value)) {
            return value
          }
          throw Object.assign(
            Error('Non-serializable object type in JSON body'),
            { object: value, body }
          )
        }),
      }
}

type ToBody<T> = T extends undefined
  ? undefined
  : T extends string
  ? { text: string }
  : T extends Buffer | globalThis.Buffer
  ? { buffer: Buffer }
  : T extends NodeJS.ReadableStream
  ? { stream: NodeJS.ReadableStream }
  : { json: T }

const isJsonReady = (body: any): boolean =>
  typeof body !== 'object' ||
  Array.isArray(body) ||
  body.constructor == Object ||
  typeof body.toJSON == 'function' ||
  body === null

const isReadableStream = (stream: any): stream is NodeJS.ReadableStream =>
  isStream(stream) &&
  (stream as any).readable !== false &&
  typeof (stream as any).read === 'function'

const isStream = (stream: any): stream is { pipe: Function } =>
  stream !== null &&
  typeof stream === 'object' &&
  typeof stream.pipe === 'function'
