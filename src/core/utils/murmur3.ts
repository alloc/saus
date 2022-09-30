import { murmurHash as hash } from 'ohash'

declare const TextEncoder: any

const nullChar = '\0'
const nullByte: Uint8Array = new TextEncoder().encode(nullChar)

export function murmurHash(data: string | Uint8Array) {
  const padding = (4 - (data.length & 3)) & 3
  if (typeof data == 'string') {
    data = data.padEnd(data.length + padding, nullChar)
    return hash(data)
  }
  const resized = new Uint8Array(data.byteLength + padding)
  resized.set(data)
  for (let i = 0; i < padding; i++) {
    resized.set(nullByte, data.length + i)
  }
  return hash(resized)
}
