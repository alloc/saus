import { unwrapBuffer } from '../buffer'
import { Endpoint } from '../endpoint'

export const unwrapBody = <T extends Endpoint.AnyBody>(
  body: T
): UnwrapBody<T> =>
  (body.stream ||
    body.webStream ||
    (body.buffer
      ? unwrapBuffer(body.buffer)
      : body.text !== undefined
      ? body.text
      : body.json !== undefined
      ? JSON.stringify(body.json)
      : undefined)) as any

export type UnwrapBody<T> = T extends { json: any }
  ? string
  : T extends { buffer: Buffer }
  ? globalThis.Buffer
  : T extends RawBody<infer U>
  ? U
  : T extends Endpoint.AnyBody
  ? any
  : undefined

type RawBody<T> = T extends any
  ? keyof Endpoint.AnyBody extends infer K
    ? K extends keyof Endpoint.AnyBody
      ? { [P in K]: T }
      : never
    : never
  : never
