import type { Headers } from './response'

const kNormalized = Symbol.for('saus:normalized')

const upperCaseRE = /(^|-)[A-Z]/
const isUpperCase = (name: string) => upperCaseRE.test(name)

/**
 * Ensure all header names are lowercase.
 */
export function normalizeHeaders(headers: Headers, trust?: boolean): Headers
export function normalizeHeaders(
  headers: Headers | undefined,
  trust?: boolean
): Headers | undefined

export function normalizeHeaders(
  headers: (Headers & { [kNormalized]?: true }) | undefined,
  trust?: boolean
): Headers | undefined {
  if (!headers || headers[kNormalized]) {
    return headers
  }

  if (!trust) {
    const names = Object.keys(headers)
    if (names.some(isUpperCase)) {
      headers = names.reduce((normalized, name) => {
        normalized[name.toLowerCase()] = headers![name]
        return normalized
      }, {} as Headers)
    }
  }

  Object.defineProperty(headers, kNormalized, { value: true })
  return headers
}
