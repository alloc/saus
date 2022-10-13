import type { Buffer } from '../buffer'

// In a Node environment, use the built-in Buffer class.
declare const globalThis: any
const NodeBuffer = globalThis.Buffer as BufferConstructor
export { NodeBuffer as Buffer }

export type UnwrapBuffer<T> = T extends ArrayBuffer | Buffer
  ? globalThis.Buffer
  : T

/**
 * Get a string or Node buffer for compatibility with Node libraries.
 *
 * In client environment, this is a no-op.
 *
 * Since this has a Node.js return type, it shouldn't be used in client
 * code except in an isomorphic context.
 */
export function unwrapBuffer<T extends string | ArrayBuffer | Buffer>(
  data: T
): UnwrapBuffer<T> {
  // Since we use Node buffers in SSR, it's usually just a type cast.
  return typeof data == 'string' || NodeBuffer.isBuffer(data)
    ? (data as any)
    : NodeBuffer.from(data as ArrayBuffer)
}
