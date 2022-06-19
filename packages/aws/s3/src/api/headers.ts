import { Headers } from 'saus/http'

export function formatAmzHeaders(values: Record<string, any>) {
  return formatHeaders(values, key => 'x-amz-' + toDashCase(key))
}

export function formatHeaders(
  values: Record<string, any>,
  transformKey: (key: string) => string = toDashCase
) {
  const headers: Headers = {}
  for (const key in values) {
    const value = values[key]
    if (value !== undefined) {
      headers[transformKey(key)] = value
    }
  }
  return headers
}

const toDashCase = (input: string) =>
  input
    .replace(/[a-z][A-Z]/g, ([prev, curr]) => prev + '-' + curr.toLowerCase())
    .toLowerCase()
