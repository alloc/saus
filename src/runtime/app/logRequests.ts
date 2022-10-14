import { Falsy } from '@utils/types'
import * as kleur from 'kleur/colors'
import { Endpoint } from '../endpoint'
import { onRequest, onResponse } from '../endpointHooks'
import type { Headers } from '../http'
import { setup } from '../setup'

/**
 * Note that request/response hooks added by `logRequests` use a
 * priority of `1,000,000` (negative for requests).
 */
export const logRequests = (
  options: {
    request?: { headers?: boolean; prefix?: string }
    response?: { headers?: boolean; prefix?: string }
    timestamp?: boolean
    elapsed?: boolean
    ignore?: (req: Endpoint.Request) => boolean | Falsy
  } = {}
) =>
  // Use `setup` to attach our hooks as late as possible.
  setup(() => {
    const timing = new WeakMap<Endpoint.Request, number>()
    const ignored = new WeakSet<Endpoint.Request>()

    onRequest(-1e6, req => {
      if (options.ignore?.(req)) {
        ignored.add(req)
        return
      }
      if (options.timestamp) {
        printTimestamp()
      }
      const method = req.method.toUpperCase()
      console.log(
        kleur.yellow((options.request?.prefix || '▶︎') + ' ' + method),
        req.path
      )
      if (options.request?.headers) {
        printHeaders(req.headers)
      }
      timing.set(req, Date.now())
    })

    onResponse(1e6, (req, res) => {
      if (ignored.has(req)) {
        return
      }
      const { status, headers } = res
      if (status == null) {
        return
      }
      let elapsed = 0
      if (options.elapsed) {
        elapsed = (Date.now() - timing.get(req)!) / 1e3
        if (isNaN(elapsed)) {
          return
        }
      }
      if (options.timestamp) {
        printTimestamp()
      }
      const statusColor = /^[23]/.test('' + status) ? kleur.green : kleur.red
      const message = [
        statusColor((options.response?.prefix || '◀︎') + ' ' + status),
        req.path,
      ]
      const contentLength = headers.get('content-length')
      if (contentLength) {
        message.push(kleur.gray((+contentLength / 1024).toFixed(2) + 'KiB'))
      }
      if (elapsed) {
        message.push(kleur.gray('in ' + elapsed.toFixed(3) + 's'))
      }
      console.log(...message)
      const headerMap = headers.toJSON()
      if (headerMap && options.response?.headers) {
        printHeaders(headerMap)
      }
    })
  })

function printHeaders(headers: Headers) {
  const names = Object.keys(headers)
  if (names.length)
    console.log(
      names
        .map(
          name => '  ' + kleur.cyan(name.toLowerCase() + ': ') + headers[name]
        )
        .join('\n')
    )
}

function printTimestamp() {
  console.log(kleur.gray('[' + new Date().toISOString() + ']'))
}
