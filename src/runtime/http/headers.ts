import { pick } from '@utils/pick'
import { PickResult } from '@utils/types'
import { CamelCase } from 'type-fest'
import { normalizeHeaders } from './normalizeHeaders'
import { Http } from './types'
import { writeHeaders } from './writeHeaders'

/**
 * This function provides a builder for defining headers in a more
 * functional style via this-chaining. The methods mutate the given
 * `headers` object, so chaining the calls is not strictly required.
 */
export class DeclaredHeaders {
  private proxy: DeclaredHeaders
  private headers: Http.ResponseHeaders | null
  constructor(
    headers: Http.ResponseHeaders | null,
    private filter: (
      name: string,
      newValue: string | string[] | undefined,
      headers: Http.ResponseHeaders
    ) => boolean = () => true
  ) {
    this.headers = headers
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
    return this.headers
  }
  /** Get a new object with only the given header names. */
  pick<P extends keyof Http.ResponseHeaders>(
    names: P[]
  ): PickResult<Http.ResponseHeaders, P> {
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
  get<P extends keyof Http.ResponseHeaders>(name: P): Http.ResponseHeaders[P] {
    return this.headers?.[name]
  }
  /**
   * Set any header.
   */
  set<K extends string>(name: K, value: Http.ResponseHeaders[K]): this
  set<K extends string>(name: K, ...params: ResponseInputParams<K>): this
  set(name: string, value: any) {
    if (value !== undefined) {
      if (name in responseInputParsers) {
        value = responseInputParsers[name as keyof ResponseInputParsers](value)
      }
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
  merge(values: Http.RequestHeaders | null | undefined) {
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
  /**
   * The next calls will be skipped if the header is already defined.
   */
  get defaults() {
    const headers = (this.headers ||= {})
    return new DeclaredHeaders(headers, name => {
      return headers[name] === undefined
    })
  }
}

export interface DeclaredHeaders extends ProxyMethods {}

type ProxyMethods = {
  readonly [K in keyof Http.CommonResponseHeaders as CamelCase<K>]: {
    (value: Http.ResponseHeaders[K] | undefined): DeclaredHeaders
    (...params: ResponseInputParams<CamelCase<K>>): DeclaredHeaders
  }
} & {
  readonly [K in keyof ShortcutHeaders]: (
    value: ShortcutHeaders[K] | undefined
  ) => DeclaredHeaders
}

const omitFalseNames = ['allowCredentials']
const commaDelimitedNames = ['allowHeaders', 'allowMethods', 'exposeHeaders']

const shortcutHeaderNames: (keyof ShortcutHeaders)[] = [
  'accessControl',
  'content',
]

export interface ShortcutHeaders {
  accessControl: Http.AccessControlHeaders
  content: Http.ContentHeaders
}

const toDashCase = (input: string) =>
  input
    .replace(/[a-z][A-Z]/g, ([prev, curr]) => prev + '-' + curr.toLowerCase())
    .toLowerCase()

type ResponseInputParsers = typeof responseInputParsers
type ResponseInputParams<K extends string> =
  K extends keyof ResponseInputParsers
    ? Parameters<ResponseInputParsers[K]>
    : [Http.ResponseHeaders[K]]

/**
 * Values passed to `DeclaredHeaders#set` are coerced to strings by
 * these parsing functions.
 */
const responseInputParsers = {
  cacheControl(...args: Http.CacheControl[]): string {
    const parsed = args.map(function parse(arg): string {
      if (typeof arg == 'string') {
        return arg
      }
      let parsed: string[]
      if (Array.isArray(arg)) {
        parsed = arg.map(parse)
      } else {
        parsed = []
        for (const [key, value] of Object.entries(arg)) {
          if (value !== undefined && value !== false) {
            parsed.push(toDashCase(key) + (value !== true ? '=' + value : ''))
          }
        }
      }
      return parsed.join(', ')
    })
    return parsed.join(', ')
  },
}
