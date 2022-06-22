import { createAmzRequestFn } from '@saus/aws-utils'
import { S3 } from './types'

export const signedRequest = (region: string) =>
  createAmzRequestFn<{
    PutObject: {
      params: S3.PutObjectRequest
      result: S3.PutObjectOutput
    }
    ListObjects: {
      params: S3.ListObjectsV2Request
      result: S3.ListObjectsV2Output
    }
    DeleteObjects: {
      params: S3.DeleteObjectsRequest
      result: S3.DeleteObjectsOutput
    }
    CopyObject: {
      params: S3.CopyObjectRequest
      result: S3.CopyObjectResult
    }
  }>({
    region,
    service: 's3',
    apiVersion: '2006-03-01',
  })
