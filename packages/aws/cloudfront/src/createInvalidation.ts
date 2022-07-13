import { joinUrl } from 'saus/core'
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
    }),
    // coerceResponse(resp) {
    //   return parseXmlResponse(resp)
    // },
  })
}
