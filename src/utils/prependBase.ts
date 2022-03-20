const trailingSlash = /\/$/

export function prependBase(uri: string, base: string) {
  return base.replace(trailingSlash, uri)
}
