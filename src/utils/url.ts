const rawUrlRE = /^(\/[^#?]*)(?:#[^?]*)?(?:\?(.+)?)?$/

export class ParsedUrl {
  constructor(readonly path: string, readonly searchParams: URLSearchParams) {
    searchParams.sort()
  }

  get search(): string {
    return this.searchParams.toString()
  }

  toString() {
    const { path, search } = this
    return search ? path + '?' + search : path
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
