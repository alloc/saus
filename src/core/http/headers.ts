import { CamelCase } from 'type-fest'
import { PickResult, PossibleKeys } from '../core'
import { writeHeaders } from '../node/writeHeaders'
import { pick } from '../utils/pick'
import { AnyToObject } from '../utils/types'
import { normalizeHeaders } from './normalizeHeaders'

export interface CommonHeaders
  extends CommonRequestHeaders,
    CommonResponseHeaders {}

export interface CommonRequestHeaders {
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept */
  accept: string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Charset */
  'accept-charset': string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding */
  'accept-encoding': string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language */
  'accept-language': string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization */
  authorization: string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cookie */
  cookie: string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Match */
  'if-match': string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since */
  'if-modified-since': string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match */
  'if-none-match': string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Unmodified-Since */
  'if-unmodified-since': string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin */
  origin: string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referer */
  referer: string
  /** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent */
  'user-agent': string
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

const toDashCase = (input: string) =>
  input
    .replace(/[a-z][A-Z]/g, ([prev, curr]) => prev + '-' + curr.toLowerCase())
    .toLowerCase()

type WrappedHeaders = Partial<CommonHeaders> | null

/**
 * This function provides a builder for defining headers in a more
 * functional style via this-chaining. The methods mutate the given
 * `headers` object, so chaining the calls is not strictly required.
 */
export class DeclaredHeaders<T extends WrappedHeaders = any> {
  private proxy: DeclaredHeaders<T>
  private headers: Record<string, string | string[]> | null
  constructor(
    headers: AnyToObject<T, WrappedHeaders>,
    private filter: (
      name: string,
      newValue: string | string[] | undefined,
      headers: Exclude<AnyToObject<T, WrappedHeaders>, null>
    ) => boolean = () => true
  ) {
    this.headers = headers as any
    return (this.proxy = new Proxy(this, {
      get(self: any, key: string, proxy: any) {
        if (self[key] || self.hasOwnProperty(key)) {
          return self[key]
        }
        if (shortcutHeaderNames.includes(key as any)) {
          const scope = toDashCase(key)
          return (props: any) => {
            if (props == null) {
              return proxy
            }
            const headers: any = (self.headers ||= {})
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
        return self.set.bind(self, toDashCase(key))
      },
    }))
  }
  /** Coerce to a `Headers` object or null. */
  toJSON() {
    return this.headers as Headers | null
  }
  /** Get a new object with only the given header names. */
  pick<P extends PossibleKeys<T>>(
    names: P[]
  ): PickResult<AnyToObject<T, WrappedHeaders>, P> {
    return pick(this.headers || {}, names, Boolean) as any
  }
  /**
   * Returns true if the `name` header is defined. \
   * Can also check the header value.
   */
  has(name: string, value?: string | RegExp) {
    const current = this.headers?.[name]
    if (current !== undefined) {
      if (value !== undefined) {
        const test =
          typeof value == 'string'
            ? (current: string) => value === current
            : (current: string) => value.test(current)

        return Array.isArray(current) ? current.some(test) : test(current)
      }
      return true
    }
    return false
  }
  get<P extends keyof Extract<T, object>>(name: P): Extract<T, object>[P]
  get(name: string): string | string[] | undefined
  get(name: string) {
    return this.headers?.[name]
  }
  /**
   * Set any header.
   */
  set(name: string, value: string | string[] | undefined) {
    if (value !== undefined) {
      const headers: any = this.headers || {}
      if (this.filter(name, value, headers)) {
        this.headers ||= headers
        headers[name] = value
      }
    }
    return this.proxy
  }
  unset(name: string) {
    if (this.headers) {
      delete this.headers[name]
    }
    return this.proxy
  }
  /** Merge headers defined in the given object. */
  merge(values: RequestHeaders | null | undefined) {
    if (values) {
      values = normalizeHeaders(values)
      for (const [key, value] of Object.entries(values)) {
        if (value !== undefined) {
          this.headers ||= {}
          this.headers[key] = value
        }
      }
    }
    return this.proxy
  }
  /** Apply defined headers to the given response. */
  apply(response: { setHeader(name: string, value: any): void }) {
    if (this.headers) {
      writeHeaders(response, this.headers)
    }
  }
  /** The next calls will be skipped if the header is already defined. */
  get defaults() {
    const headers = (this.headers ||= {})
    return new DeclaredHeaders(headers, name => {
      return headers[name] === undefined
    })
  }
}

export interface DeclaredHeaders<T extends WrappedHeaders = any>
  extends GeneratedMethods<T> {}

type GeneratedMethods<T extends WrappedHeaders = any> = {
  readonly [P in keyof CommonHeaders as CamelCase<P>]: (
    value: CommonHeaders[P] | undefined
  ) => DeclaredHeaders<T>
} & {
  readonly [P in keyof ShortcutHeaders]: (
    value: ShortcutHeaders[P] | undefined
  ) => DeclaredHeaders<T>
}
