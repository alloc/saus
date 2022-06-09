import { URLSearchParams } from 'url'
import { baseToRegex } from './base'
import { joinUrl } from './joinUrl'

const rawUrlRE = /^(\/[^#?]*)(?:#[^?]*)?(?:\?(.+)?)?$/

export { joinUrl }
export type { URLSearchParams }

const emptyParams: any = Object.freeze({})

export class ParsedUrl<RouteParams extends {} = Record<string, string>> {
  readonly path: string
  constructor(
    path: string,
    public searchParams: URLSearchParams,
    public routeParams: Readonly<RouteParams> = emptyParams
  ) {
    // Remove trailing slash (except for "/" path)
    this.path = path.replace(/(.+)\/$/, '$1')

    searchParams.sort()
  }

  get search(): string {
    return this.searchParams.toString()
  }

  toString() {
    const { path, search } = this
    return search ? path + '?' + search : path
  }

  startsWith(prefix: string) {
    return this.path.startsWith(prefix)
  }

  slice(start: number, end?: number): this {
    return cloneUrl(this, {
      path: this.path.slice(start, end),
    })
  }

  /**
   * Return a new `ParsedUrl` based on this one, but with the given
   * subpath added to the end of the URL.
   */
  append(subpath: string): this {
    return cloneUrl(this, {
      path: joinUrl(this.path, subpath),
    })
  }

  /**
   * Return a new `ParsedUrl` based on this one, but with the given
   * directory removed from the start of the URL.
   */
  withoutBase(base: string): this {
    if (!base) return this
    const baseRE = baseToRegex(base)
    return cloneUrl(this, {
      path: this.path.replace(baseRE, '/'),
    })
  }
}

export function cloneUrl<Url extends ParsedUrl>(
  url: Url,
  newProps: Partial<Url> | Partial<ParsedUrl> = {}
) {
  const newUrl = Object.assign(
    Object.create(ParsedUrl.prototype),
    url,
    newProps
  )
  if (!newProps.searchParams) {
    newUrl.searchParams = new URLSearchParams(url.searchParams)
  }
  if (!newProps.routeParams) {
    newUrl.routeParams = { ...url.routeParams }
  }
  return newUrl as Url
}

/**
 * Expects a string like `"/foo#bar?baz"`
 *
 * The url fragment (aka "hash") is stripped out, and the query string
 * (aka "search") is separated from the pathname.
 */
export function parseUrl(url: string) {
  const match = rawUrlRE.exec(url)
  if (!match) {
    throw TypeError(`Failed to parse invalid URL "${url}"`)
  }
  return new ParsedUrl(match[1], new URLSearchParams(match[2]))
}
