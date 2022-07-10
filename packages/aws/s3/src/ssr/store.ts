import { AmzCredentials } from '@saus/aws-utils'
import { deployedEnv } from 'saus'
import { AssetStore, defer, Deferred } from 'saus/core'
import { wrapBody } from 'saus/http'
import { deleteObjects } from '../deleteObjects'
import { putObject } from '../putObject'

export function createStore(bucket: string, region: string): AssetStore {
  const deleteQueue: string[] = []
  let pendingDeletion: Deferred<any> | undefined

  const creds: AmzCredentials = {
    accessKeyId: deployedEnv.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: deployedEnv.AWS_SECRET_ACCESS_KEY as string,
  }

  return {
    supportedHeaders: [
      'cache-control',
      'content-disposition',
      'content-encoding',
      'content-language',
      'content-length',
      'content-md5',
      'content-type',
      'expires',
    ],
    async put(name, data, headers) {
      await putObject(region)({
        bucket,
        key: name,
        body: wrapBody(data),
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
