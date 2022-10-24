import { Cache } from './types'

type Expirable = {
  timestamp: number
  maxAge?: Cache.MaxAge
}

export function toExpirationTime(entry: Expirable): number
export function toExpirationTime<DefaultAge extends number | null | undefined>(
  entry: Expirable,
  defaultAge: DefaultAge
): number | DefaultAge
export function toExpirationTime(entry: Expirable, defaultAge?: number) {
  if (entry.maxAge == null) {
    return arguments.length == 1 ? Infinity : defaultAge
  }
  return entry.timestamp + entry.maxAge * 1000
}

export function toExpiresHeader(ts: number, maxAge?: Cache.MaxAge) {
  return maxAge != null && isFinite(maxAge)
    ? new Date(ts + maxAge).toUTCString()
    : undefined
}
