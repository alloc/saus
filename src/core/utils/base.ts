const trailingSlash = /\/$/

export function prependBase(uri: string, base: string) {
  return base.replace(trailingSlash, uri[0] === '/' ? uri : '/' + uri)
}

export function baseToRegex(base: string) {
  return new RegExp('^' + base.replace(/\./g, '\\.'))
}
