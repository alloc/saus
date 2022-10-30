import { Http } from './types'

const kNormalized = Symbol.for('saus:normalized')

const upperCaseRE = /(^|-)[A-Z]/
const isUpperCase = (name: string) => upperCaseRE.test(name)

export function normalizeHeaderKeys(names: readonly string[]) {
  return names.map(name => name.toLowerCase())
}

/**
 * Ensure all header names are lowercase.
 */
export function normalizeHeaders<T extends Http.Headers>(
  headers: T,
  trust?: boolean
): T
export function normalizeHeaders<T extends Http.Headers>(
  headers: T | null | undefined,
  trust?: boolean
): T | undefined

export function normalizeHeaders(
  headers: (Http.Headers & { [kNormalized]?: true }) | null | undefined,
  trust?: boolean
): Http.Headers | undefined {
  if (!headers) return
  if (headers[kNormalized]) {
    return headers
  }

  if (!trust) {
    const names = Object.keys(headers)
    if (names.some(isUpperCase)) {
      headers = names.reduce((normalized, name) => {
        normalized[name.toLowerCase()] = headers![name]
        return normalized
      }, {} as Http.Headers)
    }
  }

  Object.defineProperty(headers, kNormalized, { value: true })
  return headers
}
