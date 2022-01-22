// HTTP helpers suitable for browser and web worker environments.
import { Buffer } from './buffer'

export async function get(
  url: string,
  options?: { headers?: Record<string, string> }
) {
  const resp = await fetch(url, options)
  if (resp.status == 200) {
    return Buffer.from(await resp.arrayBuffer())
  }
  throw Error(`Request to ${url} ended with status code ${resp.status}`)
}
