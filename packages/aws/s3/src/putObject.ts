import { signedRequest } from './api/request'

/**
 * Upload an object to a S3 bucket.
 */
export function putObject(region: string) {
  return signedRequest(region).action('PutObject', {
    coerceRequest(params) {
      return {
        method: 'put',
        subdomain: params.Bucket,
        path: params.Key,
        query: null,
      }
    },
    coerceResponse(resp) {
      return {
        ETag: resp.headers.etag,
      }
    },
  })
}
