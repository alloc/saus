import { UserDeviceType } from './varyByDevice'

export interface BrotliConfig {
  /**
   * Minimum file size before compression is used.
   * @default 1501
   */
  threshold?: number
}

export interface PrefixOrigin {
  prefix: string
  origin: string
  noCache?: boolean
}

/**
 * @link https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-cachepolicy-cachepolicyconfig.html
 */
export interface CachePolicyConfig {
  /**
   * Cached resources without `Cache-Control` or `Expires` header
   * will be cached for this long (in seconds).
   * @default 86400 (1 day)
   * @link https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-cachepolicy-cachepolicyconfig.html#cfn-cloudfront-cachepolicy-cachepolicyconfig-defaultttl
   */
  defaultTTL?: number
  /**
   * Enforce a minimum cache time.
   * @default 0
   * @link https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-cachepolicy-cachepolicyconfig.html#cfn-cloudfront-cachepolicy-cachepolicyconfig-minttl
   */
  minTTL?: number
  /**
   * Enforce a maximum cache time.
   * @default 31536000 (1 year)
   * @link https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-cachepolicy-cachepolicyconfig.html#cfn-cloudfront-cachepolicy-cachepolicyconfig-maxttl
   */
  maxTTL?: number
  /**
   * Cache different responses based on the device type
   * of the requester.
   */
  varyByDevice?: UserDeviceType[]
}
