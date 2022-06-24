const trailingSlash = /\/$/

export function prependBase(uri: string, base: string) {
  return base.replace(trailingSlash, uri)
}

export function baseToRegex(base: string) {
  return new RegExp('^' + base.replace(/\./g, '\\.'))
}
