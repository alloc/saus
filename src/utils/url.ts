const rawUrlRE = /^(\/[^#?]*)(?:#[^?]*)?(?:\?(.+)?)?$/

export class ParsedUrl {
  readonly path: string
  constructor(path: string, readonly searchParams: URLSearchParams) {
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

  slice(start: number, end?: number) {
    const sliced = Object.create(ParsedUrl.prototype)
    sliced.path = this.path.slice(start, end)
    sliced.searchParams = new URLSearchParams(this.searchParams)
    return sliced as ParsedUrl
  }
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
