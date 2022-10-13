export function streamToBuffer(
  s: NodeJS.ReadableStream,
  maxLength?: number
): Promise<Buffer>

export function streamToBuffer(
  s: NodeJS.ReadableStream,
  maxLength: number,
  encoding: BufferEncoding
): Promise<string>

export function streamToBuffer(
  s: NodeJS.ReadableStream,
  maxLength?: number,
  encoding?: BufferEncoding
): Promise<string | Buffer>

export function streamToBuffer(
  s: NodeJS.ReadableStream,
  maxLength = 0,
  encoding?: BufferEncoding
) {
  const trace = Error()
  return new Promise<string | Buffer>((resolve, reject) => {
    const hasMaxLength = maxLength > 0
    if (!hasMaxLength) {
      maxLength = Infinity
    }

    let bytes = 0
    let chunks: Buffer[] = []

    s.on('data', function consume(chunk) {
      if (hasMaxLength) {
        bytes += Buffer.byteLength(chunk)
        if (bytes > maxLength) {
          trace.message = 'Max length exceeded'
          reject(trace)

          chunks.length = 0
          s.removeListener('data', consume)
          return s.resume() // Drain the stream without reading.
        }
      }
      chunks.push(chunk)
    })

    // The 'end' and 'error' events will never emit on the same stream.
    s.on('error', e => {
      trace.message = e.message
      reject(trace)
    })
    s.on('end', () => {
      if (bytes <= maxLength) {
        const result = Buffer.concat(chunks)
        resolve(encoding ? result.toString(encoding) : result)
      }
    })
  })
}
