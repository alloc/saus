import { copyObject } from './copyObject'
import { deleteObjects } from './deleteObjects'

export function moveObjects(region: string) {
  return async (srcBucket: string, keys: string[], destBucket: string) => {
    const moved: string[] = []
    const moving = keys.map(key =>
      copyObject(region)({
        key,
        bucket: destBucket,
        copySource: srcBucket + '/' + key,
      })
    )
    await Promise.all(moving)
    await deleteObjects(region)({
      bucket: srcBucket,
      delete: { objects: moved.map(key => ({ key })) },
    })
  }
}
