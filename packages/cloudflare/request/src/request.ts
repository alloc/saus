import { vite } from 'saus/core'
import { http, HttpRequestOptions } from 'saus/http'
import { joinUrl } from 'saus/utils/joinUrl'

export function createRequestFn(config: {
  apiToken: string
  logger: Pick<vite.Logger, 'info'>
}) {
  return async <T = any>(
    method: Http.Method,
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
    messages?.forEach((m: string) => config.logger.info(m))
    if (success) {
      return result as T
    }
    const { message, ...error } = errors[0]
    throw Object.assign(Error(message), error)
  }
}
