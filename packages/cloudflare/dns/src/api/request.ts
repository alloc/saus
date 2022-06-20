import { joinUrl, vite } from 'saus/core'
import { http, HttpMethod, HttpRequestOptions } from 'saus/http'

export function createRequestFn(config: {
  apiToken: string
  logger: vite.Logger
}) {
  return async <T = any>(
    method: HttpMethod,
    uri: string,
    opts?: HttpRequestOptions
  ) => {
    const url = joinUrl('https://api.cloudflare.com/client/v4', uri)
    const resp = await http(method, url, {
      ...opts,
      headers: {
        ...opts?.headers,
        authorization: `Bearer ${config.apiToken}`,
      },
    })
    const { success, errors, messages, result } = resp.toJSON()
    if (success) {
      return result as T
    }
    messages.forEach((m: string) => config.logger.info(m))
    throw Error(errors[0])
  }
}
