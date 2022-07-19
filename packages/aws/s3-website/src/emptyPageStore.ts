import { createInvalidation } from '@saus/aws-cloudfront'
import { emptyBucket } from '@saus/aws-s3'
import secrets from './secrets'

/**
 * Delete all assets from the "PageStore" bucket.
 *
 * Most useful when deploying and/or if your application periodically
 * invalidates its data source (with infrequent writes).
 */
export async function emptyPageStore(props: {
  region: string
  /**
   * Pass the app version to avoid duplicate cache invalidations
   * for the same deployment (in case of deployment errors).
   */
  appVersion?: string
  /**
   * CloudFront distribution ID
   *
   * When defined, the CloudFront cache is invalidated.
   */
  cacheId?: string
  /**
   * S3 bucket name
   *
   * When defined, the bucket is emptied.
   */
  bucket?: string
}) {
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
    })
  }
}
