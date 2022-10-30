import http from 'http'
import https from 'https'

export function startRequest(
  { headers, ...opts }: Http.Options,
  trace: Error & { status?: number },
  reject: (e: any) => void,
  resolve: (resp: Http.Response) => void,
  redirectCount: number,
  onRedirect: (url: string) => void,
  retryCount = 0
): http.ClientRequest {
  const { request } = opts.protocol == 'http:' ? http : https

  const client = request(opts, resp => {
    let chunks: Buffer[]
    if (opts.sink) {
      opts.sink(resp)
    } else {
      chunks = []
      resp.on('data', chunk => {
        chunks.push(chunk)
      })
    }
    resp.on('error', e => {
      reject(updateTrace(trace, e))
    })
    resp.on('close', () => {
      if (isRedirect(resp) && redirectCount < 10) {
        return onRedirect(resp.headers.location)
      }
      const status = resp.statusCode!
      if (opts.allowBadStatus || (status >= 200 && status < 400)) {
        return resolve(
          new Http.Response(
            chunks ? Buffer.concat(chunks) : Buffer.alloc(0),
            status,
            resp.headers
          )
        )
      }
      trace.message = `Request to ${opts.href} ended with status code ${resp.statusCode}.`
      trace.status = resp.statusCode
      reject(trace)
    })
  })

  client.on('error', (e: Error & { code?: string }) => {
    if (e.code == 'ECONNRESET' && retryCount < 8) {
      return startRequest(
        { headers, ...opts },
        trace,
        reject,
        resolve,
        redirectCount,
        onRedirect,
        retryCount + 1
      )
    }
    reject(updateTrace(trace, e))
  })

  if (headers)
    for (const name in headers) {
      if (headers[name] !== undefined) {
        client.setHeader(name, headers[name]!)
      }
    }

  return client
}

function isRedirect(resp: {
  statusCode?: number
  headers: { location?: string }
}): resp is { headers: { location: string } } {
  const status = resp.statusCode!
  return (status == 301 || status == 302) && !!resp.headers.location
}

function updateTrace(trace: Error, e: Error) {
  trace.stack = e.stack! + trace.stack!.split('\n').slice(1).join('\n')
  trace.message = e.message
  return trace
}
