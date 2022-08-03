import { AmzCredentials } from '@saus/aws-utils'
import { copyObject } from './copyObject'
import { deleteObjects } from './deleteObjects'

interface Options {
  keys: string[]
  bucket: string
  newBucket: string
  creds?: AmzCredentials
}

export function moveObjects(region: string) {
  const S3 = {
    copyObject: copyObject(region),
    deleteObjects: deleteObjects(region),
  }

  return async (opts: Options) => {
    const keys = new Set(opts.keys)
    const moving = Array.from(keys, key =>
      S3.copyObject({
        key,
        bucket: opts.newBucket,
        copySource: opts.bucket + '/' + key,
        creds: opts.creds,
      }).catch(e => {
        if (e.code == 'NoSuchKey') {
          keys.delete(key)
        } else {
          throw e
        }
      })
    )
    await Promise.all(moving)
    await S3.deleteObjects({
      bucket: opts.bucket,
      delete: { objects: Array.from(keys, key => ({ key })) },
      creds: opts.creds,
    })
  }
}
