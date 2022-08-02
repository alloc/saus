export interface PurgeProps {
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
}
