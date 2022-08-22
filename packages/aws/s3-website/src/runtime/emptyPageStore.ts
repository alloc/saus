import { createInvalidation } from '@saus/aws-cloudfront'
import { emptyBucket } from '@saus/aws-s3'
import secrets from '../secrets'
import { PurgeProps } from './types'

/**
 * Delete all assets from the "PageStore" bucket.
 *
 * Most useful when deploying and/or if your application periodically
 * invalidates its data source (with infrequent writes).
 */
export async function emptyPageStore(props: PurgeProps) {
  if (props.bucket) {
    await emptyBucket(props.region)(props.bucket, {
      creds: secrets,
    })
  }
  if (props.cacheId) {
    await createInvalidation(props.region)({
      creds: secrets,
      distributionId: props.cacheId,
      invalidationBatch: {
        callerReference: 'emptyPageStore-' + (props.appVersion || Date.now()),
        paths: {
          quantity: 1,
          items: ['/*'],
        },
      },
    }).catch(e => {
      console.error(
        `Failed to invalidate CloudFront page cache (${props.cacheId}). ` +
          e.message
      )
    })
  }
}
