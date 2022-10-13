const trailingSlash = /\/$/

export function prependBase(uri: string, base = import.meta.env.BASE_URL) {
  return base.replace(trailingSlash, uri)
}
