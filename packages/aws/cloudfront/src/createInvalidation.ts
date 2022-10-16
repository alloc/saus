import { xml } from '@saus/aws-utils'
import { joinUrl } from 'saus/utils/joinUrl'
import { signedRequest } from './api/request'

export function createInvalidation(region: string) {
  return signedRequest(region).action('CreateInvalidation', {
    coerceRequest: params => ({
      method: 'post',
      path: joinUrl(
        params.Version,
        'distribution',
        params.DistributionId,
        'invalidation'
      ),
      query: null,
      body: xml()
        .open('InvalidationBatch', {
          xmlns: `http://cloudfront.amazonaws.com/doc/${params.Version}/`,
        })
        .props(params.InvalidationBatch, (key, value) => {
          return key == 'Items'
            ? (value as string[]).map(glob => ({ Path: glob }))
            : value
        })
        .close()
        .toString(),
    }),
  })
}
