// Simple wrapper around TextDecoder to help provide HTTP helpers
// that work in all environments.

export class Buffer {
  protected constructor(readonly buffer: ArrayBuffer) {}

  static from(data: ArrayBuffer) {
    return new Buffer(data)
  }

  toString(encoding?: string) {
    const decoder = new TextDecoder(encoding)
    return decoder.decode(this.buffer)
  }
}
