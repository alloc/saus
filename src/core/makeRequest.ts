import { emptyHeaders } from '../app/global'
import type { RequestHeaders } from '../http'
import { assignDefaults } from '../utils/assignDefaults'
import { defer } from '../utils/defer'
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
  headers: Readonly<RequestHeaders> = emptyHeaders,
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
  respondWith: Endpoint.RespondWith
): Endpoint.Request<Params> {
  const request = Object.assign(
    Object.create(ParsedUrl.prototype),
    url
  ) as Endpoint.Request<Params>
  request.respondWith = respondWith
  request.promise = respondWithPromise
  return assignDefaults<any>(request, url.routeParams)
}

function respondWithPromise(this: Endpoint.Request) {
  const { promise, resolve } = defer<any>()
  this.respondWith(promise)
  return (...args: any[]) => resolve(args)
}
