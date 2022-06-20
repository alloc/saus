import { ServerResponse } from 'http'
import { CamelCase } from 'type-fest'
import { writeHeaders } from '../runtime/writeHeaders'
import { normalizeHeaders } from './normalizeHeaders'

export interface CommonHeaders
  extends CommonRequestHeaders,
    CommonResponseHeaders {}

export interface CommonRequestHeaders {
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization */
  authorization: string
}

export interface CommonResponseHeaders {
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control */
  'cache-control': string
  /** @link https://developers.cloudflare.com/cache/about/cdn-cache-control */
  'cdn-cache-control': string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding */
  'content-encoding': string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Language */
  'content-language': string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Length */
  'content-length': string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type */
  'content-type': string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag */
  etag: string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expires */
  expires: string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified */
  'last-modified': string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Link */
  link: string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location */
  location: string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie */
  'set-cookie': string | string[]
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Transfer-Encoding */
  'transfer-encoding': string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary */
  vary: string
}

export type Headers = RequestHeaders | ResponseHeaders

export type RequestHeaders = Partial<CommonRequestHeaders> &
  Record<string, string | string[] | undefined>

export type ResponseHeaders = Partial<CommonResponseHeaders> &
  Record<string, string | string[] | undefined>

export interface ContentHeaders {
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding */
  encoding?: string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Length */
  length?: number | string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type */
  type?: string
}

export interface AccessControlHeaders {
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials */
  allowCredentials?: boolean
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Headers */
  allowHeaders?: '*' | string[]
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Methods */
  allowMethods?: '*' | string[]
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin */
  allowOrigin?: string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers */
  exposeHeaders?: string[]
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age */
  maxAge?: number | string
}

const omitFalseNames = ['allowCredentials']
const commaDelimitedNames = ['allowHeaders', 'allowMethods', 'exposeHeaders']

const shortcutHeaderNames: (keyof ShortcutHeaders)[] = [
  'accessControl',
  'content',
]

export interface ShortcutHeaders {
  accessControl: AccessControlHeaders
  content: ContentHeaders
}

export type DeclaredHeaders<T = Headers | null> = {
  readonly [P in keyof CommonHeaders as CamelCase<P>]: (
    value: CommonHeaders[P] | undefined
  ) => DeclaredHeaders<T>
} & {
  readonly [P in keyof ShortcutHeaders]: (
    value: ShortcutHeaders[P] | undefined
  ) => DeclaredHeaders<T>
} & {
  readonly [name: string]: (
    value: string | string[] | undefined
  ) => DeclaredHeaders<T>
} & {
  /** Apply defined headers to the given response. */
  readonly apply: (response: {
    setHeader(name: string, value: any): void
  }) => void
  /** Merge headers defined in the given object. */
  readonly merge: (headers: Headers | null | undefined) => DeclaredHeaders<T>
  /** The next calls will be skipped if the header is already defined. */
  readonly defaults: DeclaredHeaders<T>
  /** Coerce to a `Headers` object or null. */
  readonly toJSON: () => T
}

const toDashCase = (input: string) =>
  input
    .replace(/[a-z][A-Z]/g, ([prev, curr]) => prev + '-' + curr.toLowerCase())
    .toLowerCase()

/**
 * This function provides a builder for defining headers in a more
 * functional style via this-chaining. The methods mutate the given
 * `headers` object, so chaining the calls is not strictly required.
 */
export function makeDeclaredHeaders<T extends Headers | null>(
  init: T | undefined,
  filter: (
    name: string,
    newValue: string | string[] | undefined,
    headers: Headers
  ) => boolean = () => true
): DeclaredHeaders<T> {
  const headers = (init || {}) as Headers
  return new Proxy(headers as any, {
    get(_, key: string, proxy) {
      if (key == 'toJSON') {
        return () => normalizeHeaders(headers)
      }
      if (key == 'merge') {
        return (values: any) => {
          if (values) {
            values = normalizeHeaders(values)
            for (const key in values) {
              if (values[key] !== undefined) {
                headers[key] = values[key]
              }
            }
          }
          return proxy
        }
      }
      if (key == 'apply') {
        return (response: ServerResponse) => {
          writeHeaders(response, headers)
        }
      }
      if (key == 'defaults') {
        return makeDeclaredHeaders(headers, name => {
          return headers[name] === undefined
        })
      }
      if (shortcutHeaderNames.includes(key as any)) {
        const scope = toDashCase(key)
        return (props: any) => {
          if (props == null) return proxy
          for (const prop in props) {
            const name = scope + '-' + prop
            const newValue = props[prop]
            if (!filter(name, newValue, headers)) {
              continue
            }
            headers[name] =
              newValue != null
                ? Array.isArray(newValue)
                  ? commaDelimitedNames.includes(prop)
                    ? newValue.join(', ')
                    : newValue
                  : newValue === false && omitFalseNames.includes(prop)
                  ? undefined
                  : '' + newValue
                : undefined
          }
          return proxy
        }
      }
      return (value: any) => {
        const name = toDashCase(key)
        if (filter(name, value, headers)) {
          headers[name] = value
        }
        return proxy
      }
    },
  })
}
