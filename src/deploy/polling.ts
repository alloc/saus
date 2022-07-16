import { http } from '@/http'

interface PollOptions {
  /**
   * The hostname and protocol.
   * @example
   * "https://example.com/"
   */
  base: string
  /**
   * The path to send requests to.
   * @example
   * "/deployment/version"
   */
  path: string
  expect: {
    /**
     * The expected response status.
     */
    status?: number
    /**
     * The expected response body.
     */
    body?: string
  }
  /**
   * Number of seconds between response and next request.
   * @default 15
   */
  interval?: number
}

/**
 * Returns a promise that resolves when the server responds with
 * the expected status and body.
 */
export async function pollDeployment(opts: PollOptions) {
  const interval = opts.interval || 15
  while (true) {
    const resp = await http('get', opts.path, {
      base: opts.base,
      allowBadStatus: true,
      timeout: interval,
    })
    if (!opts.expect.status || resp.status == opts.expect.status) {
      if (opts.expect.body == null) {
        return
      }
      const body = resp.data.toString()
      if (body == opts.expect.body) {
        return
      }
    }
    await new Promise(done => setTimeout(done, interval))
  }
}
