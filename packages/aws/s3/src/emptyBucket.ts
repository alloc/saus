import { deleteObjects } from './deleteObjects'
import { listObjects } from './listObjects'

export function emptyBucket(region: string) {
  return async (bucket: string) => {
    const deleting: Promise<any>[] = []
    const continueEmpty = async (token?: string) => {
      const listResult = await listObjects(region)({
        bucket,
        continuationToken: token,
      })
      if (listResult.contents) {
        deleting.push(
          deleteObjects(region)({
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
