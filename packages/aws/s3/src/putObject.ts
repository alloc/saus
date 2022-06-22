import { formatAmzHeaders } from './api/headers'
import { commonParamKeys } from './api/params'
import { signedRequest } from './api/request'
import { pickAllExcept } from './utils/pick'

/**
 * Upload an object to a S3 bucket.
 */
export function putObject(region: string) {
  return signedRequest(region).action('PutObject', {
    coerceRequest(params) {
      const headerParams = pickAllExcept(params, ['Key', ...commonParamKeys])
      return {
        method: 'put',
        subdomain: params.Bucket,
        path: params.Key,
        query: null,
        headers: formatAmzHeaders(headerParams),
      }
    },
    coerceResponse(resp) {
      return {
        ETag: resp.headers.etag,
      }
    },
  })
}
