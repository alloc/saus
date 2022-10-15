// HTTP helpers suitable for browser and web worker environments.
import type { GetOptions } from '@runtime/http/get'
import type { Headers } from '@runtime/http/headers'
import { normalizeHeaders } from '@runtime/http/normalizeHeaders'
import { Response } from '@runtime/http/response'
import { Buffer } from '@utils/buffer'

export async function get(url: string, options?: GetOptions) {
  let signal: AbortSignal | undefined
  if (options?.timeout !== undefined) {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), options.timeout)
    signal = ctrl.signal
  }
  const resp = await fetch(url, {
    ...options,
    headers: options?.headers as HeadersInit,
    signal,
  })
  if (resp.status >= 200 && resp.status < 400) {
    const headers: Headers = {}
    resp.headers.forEach((value, key) => {
      headers[key] = value
    })
    return new Response(
      Buffer.from(await resp.arrayBuffer()),
      resp.status,
      normalizeHeaders(headers, true)
    )
  }
  throw Error(`Request to ${url} ended with status code ${resp.status}`)
}
