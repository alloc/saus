import { Endpoint, WritableStream } from '../endpoint'
import { unwrapBody } from './unwrapBody'

export function writeBody(
  res: NodeJS.WritableStream | WritableStream,
  body: Endpoint.AnyBody
): void

export function writeBody(
  res: NodeJS.WritableStream | WritableStream,
  body: any
): void {
  if (body.stream) {
    body.stream.pipe(res, { end: true })
  } else if (body.webStream) {
    body.webStream.pipeTo(res)
  } else {
    const rawBody = unwrapBody(body) as string | Buffer | undefined
    if (rawBody === undefined) {
      return
    }
    if ('write' in res) {
      res.write(rawBody.toString())
      res.end()
    } else {
      const writer = res.getWriter()
      writer.write(rawBody.toString())
      writer.close()
      res.close()
    }
  }
}
