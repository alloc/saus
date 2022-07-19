import { joinUrl, vite } from 'saus/core'
import { http, HttpMethod, HttpRequestOptions } from 'saus/http'

export function createRequestFn(config: {
  apiToken: string
  logger: Pick<vite.Logger, 'info'>
}) {
  return async <T = any>(
    method: HttpMethod,
    uri: string,
    opts?: HttpRequestOptions
  ): Promise<T> => {
    const url = joinUrl('https://api.cloudflare.com/client/v4', uri)
    const resp = await http(method, url, {
      ...opts,
      allowBadStatus: true,
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
