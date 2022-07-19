import { AmzRequestOptions } from '@saus/aws-utils'
import { deleteObjects } from './deleteObjects'
import { listObjects } from './listObjects'

export function emptyBucket(region: string) {
  return async (bucket: string, opts?: AmzRequestOptions) => {
    const deleting: Promise<any>[] = []
    const continueEmpty = async (token?: string) => {
      const listResult = await listObjects(region)({
        ...opts,
        bucket,
        continuationToken: token,
      })
      if (listResult.contents) {
        deleting.push(
          deleteObjects(region)({
            ...opts,
            bucket,
            delete: {
              objects: listResult.contents.map(object => ({
                key: object.key!,
              })),
            },
          })
        )
        if (listResult.continuationToken) {
          await continueEmpty(listResult.continuationToken)
        }
      }
    }
    await continueEmpty()
    await Promise.all(deleting)
  }
}
