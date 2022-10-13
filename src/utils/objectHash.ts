import { murmurHash } from './murmur3'
import { sortObjects } from './sortObjects'

export function toObjectHash(data: object) {
  const json = JSON.stringify(data, sortObjects)
  return murmurHash(json)
}
