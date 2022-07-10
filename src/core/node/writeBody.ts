import { Endpoint } from '../endpoint'
import { unwrapBody } from '../http/unwrapBody'

export function writeBody(res: NodeJS.WritableStream, body: Endpoint.AnyBody) {
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
