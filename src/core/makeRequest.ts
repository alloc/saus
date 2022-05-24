import { emptyHeaders } from '../app/global'
import type { Headers } from '../http'
import { assignDefaults } from '../utils/assignDefaults'
import type { Endpoint } from './endpoint'
import { ParsedUrl } from './utils'

const emptyBody = Buffer.from(globalThis.Buffer.alloc(0).buffer)
const emptyRead = async () => emptyBody

/**
 * Attach `method` and `headers` properties to the given URL.
 */
export function makeRequestUrl<Params extends {}>(
  url: ParsedUrl<Params>,
  method: string,
  headers: Headers = emptyHeaders,
  read = emptyRead
): Endpoint.RequestUrl<Params> {
  if (isRequestUrl(url)) {
    return url
  }
  const requestUrl = url as ParsedUrl<Params> & {
    method: typeof method
    headers: typeof headers
    read: typeof read
  }
  requestUrl.method = method
  requestUrl.headers = headers
  requestUrl.read = read
  return requestUrl
}

function isRequestUrl<T extends {} = any>(
  arg: ParsedUrl
): arg is Endpoint.RequestUrl<T> {
  return 'method' in arg
}

/**
 * Convert the given `url` into a Saus request.
 */
export function makeRequest<Params extends {}>(
  url: Endpoint.RequestUrl<Params>,
  respondWith: (...response: Endpoint.ResponseTuple) => void
): Endpoint.Request<Params> {
  const request = Object.assign(
    Object.create(ParsedUrl.prototype),
    url
  ) as Endpoint.Request<Params>
  request.respondWith = respondWith
  return assignDefaults<any>(request, url.routeParams)
}
