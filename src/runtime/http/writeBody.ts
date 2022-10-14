import { Buffer } from '@utils/buffer'
import { Simplify, UnionToIntersection } from 'type-fest'
import { unwrapBody } from './unwrapBody'

export type Body =
  | { buffer: Buffer }
  | { stream: NodeJS.ReadableStream }
  | { text: string; mime?: string }
  | { json?: any }

export type AnyBody = Simplify<Partial<UnionToIntersection<Body>>>

export function writeBody(res: NodeJS.WritableStream, body: AnyBody) {
  if (body.stream) {
    body.stream.pipe(res, { end: true })
  } else {
    const rawBody: any = unwrapBody(body)
    if (rawBody !== null) {
      res.write(rawBody)
    }
    res.end()
  }
}
