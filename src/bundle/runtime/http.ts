// Nothing remarkable in here. It just allows Saus-related packages to
// send a GET request and receive a `Buffer` in a serverless environment
// where Node.js built-in modules are unavailable.

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
