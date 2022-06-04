import crypto from 'crypto'

export function md5Hex(data: string | string[]) {
  const hash = crypto.createHash('md5')

  if (Array.isArray(data)) {
    for (const element of data) {
      hash.update(element, 'utf8')
    }
  } else {
    hash.update(data, 'utf8')
  }

  return hash.digest('hex')
}
