import { Endpoint } from '../core'
import { unwrapBuffer } from '../core/buffer'

export function writeBody(res: NodeJS.WritableStream, body: Endpoint.Body) {
  if ('stream' in body) {
    body.stream.pipe(res, { end: true })
  } else {
    const rawBody =
      'buffer' in body
        ? unwrapBuffer(body.buffer)
        : 'text' in body
        ? body.text
        : 'json' in body
        ? JSON.stringify(body.json)
        : null

    if (rawBody !== null) {
      res.write(rawBody)
    }
    res.end()
  }
}
