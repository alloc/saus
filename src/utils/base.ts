const trailingSlash = /\/$/

export function prependBase(uri: string, base: string) {
  return base.replace(trailingSlash, uri)
}

export function baseToRegex(base: string) {
  base = base.replace(/\./g, '\\.')
  base = base.replace(trailingSlash, '(/|$)')
  return new RegExp('^' + base)
}
