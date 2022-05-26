import http from 'http'
import https from 'https'
import { Response } from '../response'
import { HttpOptions } from '../types'

export function startRequest(
  opts: HttpOptions,
  trace: Error & { status?: number },
  reject: (e: any) => void,
  resolve: (resp: Response) => void,
  redirectCount: number,
  onRedirect: (url: string) => void
): http.ClientRequest {
  const { request } = opts.protocol == 'http:' ? http : https

  const client = request(opts, resp => {
    const chunks: Buffer[] = []
    resp.on('data', chunk => {
      chunks.push(chunk)
    })
    resp.on('error', e => {
      trace.message = e.message
      reject(trace)
    })
    resp.on('close', () => {
      if (isRedirect(resp) && redirectCount < 10) {
        return onRedirect(resp.headers.location)
      }
      const status = resp.statusCode!
      if (opts.allowBadStatus || (status >= 200 && status < 400)) {
        return resolve(
          new Response(Buffer.concat(chunks), status, resp.headers)
        )
      }
      trace.message = `Request to ${opts.href} ended with status code ${resp.statusCode}.`
      trace.status = resp.statusCode
      reject(trace)
    })
  })

  client.on('error', e => {
    trace.message = e.message
    reject(trace)
  })

  return client
}

function isRedirect(resp: {
  statusCode?: number
  headers: { location?: string }
}): resp is { headers: { location: string } } {
  const status = resp.statusCode!
  return (status == 301 || status == 302) && !!resp.headers.location
}
