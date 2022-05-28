// HTTP helpers suitable for browser and web worker environments.
import type { GetOptions } from '../../http/get'
import { Headers, Response } from '../../http/response'
import { Buffer } from '../buffer'

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
      headers
    )
  }
  throw Error(`Request to ${url} ended with status code ${resp.status}`)
}
