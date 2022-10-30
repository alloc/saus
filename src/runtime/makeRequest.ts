import { assignDefaults } from '@utils/assignDefaults'
import { defer } from '@utils/defer'
import { emptyHeaders } from './app/constants'
import type { Endpoint } from './endpoint'
import { ParsedUrl } from './url'

const emptyBody = Buffer.from(globalThis.Buffer.alloc(0).buffer)
const emptyRead = async (encoding?: BufferEncoding) =>
  encoding ? '' : emptyBody

const defaultProps = {
  method: 'GET',
  headers: emptyHeaders,
  read: emptyRead,
  json: readJson,
}

/**
 * Attach `method` and `headers` properties to the given URL.
 */
export function makeRequestUrl<Params extends {}>(
  url: ParsedUrl<Params>,
  props: {
    method?: string
    headers?: Readonly<Http.RequestHeaders>
    read?: (encoding?: BufferEncoding) => Promise<string | Buffer>
    object?: any
  } = {}
): Endpoint.RequestUrl<Params> {
  if (isRequestUrl(url)) {
    return url
  }
  return Object.assign(url, defaultProps, props) as any
}

async function readJson(this: Endpoint.RequestUrl) {
  const data = await this.read('utf8')
  return JSON.parse(data)
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
  return assignDefaults<any, any>(request, url.routeParams)
}

function respondWithPromise(this: Endpoint.Request) {
  const { promise, resolve } = defer<any>()
  this.respondWith(promise)
  return (...args: any[]) => resolve(args)
}
