import * as kleur from 'kleur/colors'
import { Endpoint } from '../core/endpoint'
import { setup } from '../core/setup'
import type { Headers } from '../http'
import { onRequest, onResponse } from '../routes'

export const logRequests = (
  options: {
    request?: { headers?: boolean; prefix?: string }
    response?: { headers?: boolean; prefix?: string }
    timestamp?: boolean
    elapsed?: boolean
  } = {}
) =>
  // Use `setup` to attach our hooks as late as possible.
  setup(() => {
    const timing = new WeakMap<Endpoint.Request, number>()

    onRequest('pre', req => {
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

    onResponse((req, [status, headers]) => {
      if (options.timestamp) {
        printTimestamp()
      }
      const elapsed = options.elapsed && (Date.now() - timing.get(req)!) / 1e3
      const statusColor = /^[23]/.test('' + status) ? kleur.green : kleur.red
      const message = [
        statusColor((options.response?.prefix || '◀︎') + ' ' + status),
        req.path,
      ]
      const contentLength = headers && headers['Content-Length']
      if (contentLength) {
        message.push(kleur.gray((+contentLength / 1024).toFixed(2) + 'KiB'))
      }
      if (options.elapsed) {
        message.push(kleur.gray('in ' + (elapsed as number).toFixed(3) + 's'))
      }
      console.log(...message)
      if (headers && options.response?.headers) {
        printHeaders(headers)
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
