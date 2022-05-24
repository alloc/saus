import * as kleur from 'kleur/colors'
import { setup } from '../core/setup'
import type { Headers } from '../http'
import { onRequest, onResponse } from '../routes'

export const logRequests = (
  options: {
    request?: { headers?: boolean; prefix?: string }
    response?: { headers?: boolean; prefix?: string }
    timestamp?: boolean
  } = {}
) =>
  // Use `setup` to attach our hooks as late as possible.
  setup(() => {
    onRequest('pre', req => {
      if (options.timestamp) {
        printTimestamp()
      }
      console.log(
        kleur.yellow(
          (options.request?.prefix || '▶︎') + ' ' + req.method.toUpperCase()
        ),
        req.path
      )
      if (options.request?.headers) {
        printHeaders(req.headers)
      }
    })

    onResponse((req, [status, headers]) => {
      const statusColor = /^[23]/.test('' + status) ? kleur.green : kleur.red
      const contentLength = headers && headers['Content-Length']
      if (options.timestamp) {
        printTimestamp()
      }
      console.log(
        statusColor((options.response?.prefix || '◀︎') + ' ' + status),
        req.path,
        contentLength
          ? kleur.gray((+contentLength / 1024).toFixed(2) + 'KiB')
          : ''
      )
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
