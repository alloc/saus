import blueimpMd5 from 'blueimp-md5'

export function md5Hex(data: string | string[]) {
  if (Array.isArray(data)) {
    data = data.join('')
  }

  return blueimpMd5(data)
}
