import { md5Hex } from './md5-hex'
import { sortObjects } from './sortObjects'

export function toObjectHash(data: object, length = 8) {
  const json = JSON.stringify(data, sortObjects)
  return md5Hex(json).slice(0, length)
}
