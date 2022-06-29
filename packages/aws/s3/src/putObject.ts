import { createHash } from 'crypto'
import * as mime from 'mrmime'
import { controlExecution, unwrapBody } from 'saus/core'
import { paramsToHeaders } from './api/headers'
import { signedRequest } from './api/request'
import { writeThrottler } from './utils/throttle'

/**
 * Upload an object to a S3 bucket.
 */
export function putObject(region: string) {
  return controlExecution(
    signedRequest(region).action('PutObject', {
      coerceRequest(params, opts) {
        let body: string | Buffer | undefined
        if (opts.body) {
          if ('stream' in opts.body) {
            throw Error('putObject does not support streams')
          }
          body = unwrapBody(opts.body) as string | Buffer
        }
        if (body === undefined) {
          throw Error('putObject needs a request body')
        }
        return {
          method: 'put',
          subdomain: params.Bucket,
          path: params.Key,
          query: null,
          headers: {
            ...paramsToHeaders(params, ['Key']),
            'content-type': mime.lookup(params.Key),
            'content-length': Buffer.byteLength(body),
            'x-amz-content-sha256': createHash('sha256')
              .update(body)
              .digest('hex'),
          },
        }
      },
      coerceResponse(resp) {
        return {
          ETag: resp.headers.etag,
        }
      },
    })
  ).with(writeThrottler)
}
