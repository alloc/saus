import { unwrapBody } from '../http/unwrapBody'
import { Endpoint } from '../runtime/endpoint'

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
