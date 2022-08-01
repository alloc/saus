// Simple wrapper around TextDecoder to help provide HTTP helpers
// that work in all environments.

export class Buffer {
  protected constructor(readonly buffer: ArrayBuffer) {}

  get length() {
    return this.buffer.byteLength
  }

  static isBuffer(buf: any): buf is Buffer {
    return buf instanceof Buffer
  }

  static from(data: ArrayBuffer) {
    return new Buffer(data)
  }

  toString(encoding?: string): string {
    const decoder = new TextDecoder(encoding)
    return decoder.decode(this.buffer)
  }
}

export function unwrapBuffer(buf: Buffer) {
  return buf // Client buffers remain unchanged.
}
