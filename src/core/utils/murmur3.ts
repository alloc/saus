import { murmurHash as hash } from 'ohash'

export function murmurHash(s: string) {
  const padding = (4 - (s.length & 3)) & 3
  return hash(s.padEnd(s.length + padding, '\0'))
}
