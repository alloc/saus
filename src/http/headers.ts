import { CamelCase } from 'type-fest'

export interface CommonHeaders {
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

export type Headers = Partial<CommonHeaders> &
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

export type OutgoingHeaders = {
  readonly [P in keyof CommonHeaders as CamelCase<P>]: (
    value: CommonHeaders[P] | undefined
  ) => OutgoingHeaders
} & {
  readonly [P in keyof ShortcutHeaders]: (
    value: ShortcutHeaders[P] | undefined
  ) => OutgoingHeaders
} & {
  readonly [name: string]: (
    value: string | string[] | undefined
  ) => OutgoingHeaders
} & {
  readonly toHeaders: () => Headers
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
export function makeOutgoingHeaders(headers: Headers): OutgoingHeaders {
  return new Proxy(headers as any, {
    get(_, key: string, proxy) {
      if (key == 'toHeaders') {
        return () => headers
      }
      if (shortcutHeaderNames.includes(key as any)) {
        const scope = toDashCase(key)
        return (props: any) => {
          if (props == null) return proxy
          for (const prop in props) {
            const newValue = props[prop]
            headers[scope + '-' + prop] =
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
        headers[toDashCase(key)] = value
        return proxy
      }
    },
  })
}
