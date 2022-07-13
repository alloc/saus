import { createAmzRequestFn } from '@saus/aws-utils'
import { CloudFront } from './types'

export const signedRequest = (region: string) =>
  createAmzRequestFn<{
    CreateInvalidation: {
      params: CloudFront.CreateInvalidationRequest
      result: CloudFront.CreateInvalidationResult
    }
  }>({
    region,
    service: 'cloudfront',
    apiVersion: '2020-05-31',
  })
