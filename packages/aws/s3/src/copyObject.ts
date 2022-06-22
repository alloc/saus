import { parseXmlResponse } from '@saus/aws-utils'
import { paramsToHeaders } from './api/headers'
import { signedRequest } from './api/request'

export function copyObject(region: string) {
  return signedRequest(region).action('CopyObject', {
    coerceRequest(params) {
      return {
        method: 'put',
        subdomain: params.Bucket,
        path: params.Key,
        query: null,
        headers: paramsToHeaders(params, ['Key']),
      }
    },
    coerceResponse(resp) {
      return parseXmlResponse(resp).CopyObjectResult
    },
  })
}
