// HTTP helpers suitable for browser and web worker environments.
import type { GetOptions } from '@runtime/http/get'
import { normalizeHeaders } from '@runtime/http/normalizeHeaders'
import { HttpResponse } from '@runtime/http/response'
import type { Http } from '@runtime/http/types'
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
    const headers: Http.ResponseHeaders = {}
    resp.headers.forEach((value, key) => {
      headers[key] = value
    })
    return new HttpResponse(
      Buffer.from(await resp.arrayBuffer()),
      resp.status,
      normalizeHeaders(headers, true)
    )
  }
  throw Error(`Request to ${url} ended with status code ${resp.status}`)
}
