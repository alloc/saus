import { AmzCredentials } from '@saus/aws-utils'
import { AssetStore, defer, Deferred, runtimeSecrets } from 'saus/core'
import { deleteObjects } from '../deleteObjects'
import { putObject } from '../putObject'

export function createStore(bucket: string, region: string): AssetStore {
  const deleteQueue: string[] = []
  let pendingDeletion: Deferred<any> | undefined

  const creds: AmzCredentials = {
    accessKeyId: runtimeSecrets.AWS_ACCESS_KEY_ID,
    secretAccessKey: runtimeSecrets.AWS_SECRET_ACCESS_KEY,
  }

  return {
    async put(name, data, headers) {
      await putObject(region)({
        bucket,
        key: name,
        body: data,
        headers,
        creds,
      })
    },
    async delete(name) {
      if (!pendingDeletion) {
        const { resolve } = (pendingDeletion = defer())
        queueMicrotask(() => {
          const objects = deleteQueue.map(key => ({ key }))
          deleteQueue.length = 0
          resolve(
            deleteObjects(region)({
              delete: { objects },
              bucket,
              creds,
            })
          )
        })
      }
      deleteQueue.push(name)
      await pendingDeletion.promise
    },
  }
}
