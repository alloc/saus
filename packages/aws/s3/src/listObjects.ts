import { parseXmlResponse } from '@saus/aws-utils'
import { formatAmzHeaders, formatHeaders } from './api/headers'
import { commonParamKeys } from './api/params'
import { signedRequest } from './api/request'
import { S3 } from './api/types'
import { pickAllExcept } from './utils/pick'

export function listObjects(region: string) {
  return signedRequest(region).action('ListObjects', {
    coerceRequest(params) {
      const headerKeys = ['RequestPayer', 'ExpectedBucketOwner'] as const
      const query = pickAllExcept(params, [...headerKeys, ...commonParamKeys])
      return {
        xml: {
          arrayTags: ['CommonPrefixes'],
          booleanTags: ['IsTruncated'],
          numberTags: ['KeyCount', 'MaxKeys', 'Size'],
        },
        subdomain: params.Bucket,
        query: formatHeaders({ ListType: 2, ...query }),
        headers: formatAmzHeaders(
          pickAllExcept(params, Object.keys(query).concat(commonParamKeys))
        ),
      }
    },
    coerceResponse(resp) {
      const data = parseXmlResponse(resp)
        .ListBucketResult as S3.ListObjectsV2Output
      if (data.Contents && !Array.isArray(data.Contents)) {
        data.Contents = [data.Contents as any]
      }
      return data
    },
  })
}
