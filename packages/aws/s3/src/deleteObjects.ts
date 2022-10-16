import { parseXmlResponse, xml } from '@saus/aws-utils'
import * as crypto from 'crypto'
import { controlExecution } from 'saus/utils/controlExecution'
import { formatAmzHeaders } from './api/headers'
import { commonParamKeys } from './api/params'
import { signedRequest } from './api/request'
import { pickAllExcept } from './utils/pick'
import { writeThrottler } from './utils/throttle'

export function deleteObjects(region: string) {
  return controlExecution(
    signedRequest(region).action('DeleteObjects', {
      coerceRequest(params) {
        const { ChecksumAlgorithm: checksumAlgo, ...headerParams } =
          pickAllExcept(params, ['Delete', ...commonParamKeys])

        const body = xml()
          .open('Delete', {
            xmlns: `http://s3.amazonaws.com/doc/${params.Version}/`,
          })
          .list(open => {
            for (const s3Object of params.Delete.Objects) {
              open('Object').props(s3Object)
            }
          })
          .close()
          .toString()

        const amzHeaders = formatAmzHeaders({
          ...headerParams,
          SdkChecksumAlgorithm: checksumAlgo,
        })

        return {
          method: 'post',
          subdomain: params.Bucket,
          query: { delete: '' },
          body,
          headers: {
            ...amzHeaders,
            'content-type': 'application/xml',
            'content-md5': crypto
              .createHash('md5')
              .update(body)
              .digest('base64'),
          },
        }
      },
      coerceResponse(resp) {
        return parseXmlResponse(resp).DeleteResult
      },
    })
  ).with(writeThrottler)
}
