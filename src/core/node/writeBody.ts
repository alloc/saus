import { Endpoint } from '../endpoint'
import { unwrapBody } from './unwrapBody'

export function writeBody(res: NodeJS.WritableStream, body: Endpoint.AnyBody) {
  if (body.stream) {
    body.stream.pipe(res, { end: true })
  } else {
    const rawBody = unwrapBody(body)
    if (rawBody !== null) {
      res.write(rawBody)
    }
    res.end()
  }
}
