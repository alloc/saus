import type { Buffer as IBuffer } from '../client/Buffer'

declare class Buffer extends IBuffer {}
export { Buffer }

export type UnwrapBuffer<T> = T extends ArrayBuffer | Buffer
  ? globalThis.Buffer
  : T

/**
 * Get a string or Node buffer for compatibility with Node libraries.
 */
export function unwrapBuffer<T extends string | ArrayBuffer | Buffer>(
  data: T
): UnwrapBuffer<T> {
  // Since we use Node buffers in SSR, it's usually just a type cast.
  return typeof data == 'string' || global.Buffer.isBuffer(data)
    ? (data as any)
    : global.Buffer.from(data as ArrayBuffer)
}
