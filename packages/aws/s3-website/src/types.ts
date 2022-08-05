import type { CommonRequestHeaders } from 'saus/http'
import { UserDeviceType } from './varyByDevice'

export interface BrotliConfig {
  /**
   * Minimum file size before compression is used.
   * @default 1501
   */
  threshold?: number
}

export interface OriginOverride {
  /**
   * That request path(s) to intercept.
   */
  path: string | string[]
  /**
   * The domain that receives the requests. It can include an optional
   * pathname (like `/api`) that is prepended to the request path.
   *
   * Pass `null` to use the default origin.
   */
  origin: string | null
  noCache?: boolean
  /**
   * Which HTTP methods are allowed
   * @default "all"
   */
  httpMethods?: 'readOnly' | 'all'
  httpsOnly?: boolean
  /**
   * By default, all requests to this origin will inherit the
   * same controls as the main origin.
   *
   * Set this to `allViewer` to forward the unaltered request instead.
   * @default "inherit"
   */
  requestPolicy?: 'allViewer' | 'inherit'
}

export interface VaryConfig {
  /**
   * Cache different responses based on specific cookies
   * that might exist in the request headers.
   */
  cookies?: readonly string[]
  /**
   * Cache different responses based on the client's device type,
   * which is inferred from CloudFront-defined headers like
   * `CloudFront-Is-Mobile-Viewer`.
   */
  device?: readonly UserDeviceType[]
  /**
   * Add additional headers that will vary the response.
   *
   * **Accept, Accept-Language, etc**
   *
   * The "Accept" family of headers is excluded by default. Their space
   * of variations (due to q-factor weighting) easily leads to unwanted
   * duplication in CloudFront's cache, which can be expensive.
   *
   * This option exists in case you don't mind paying for such duplication.
   * But you should first consider the other approach, which involves
   * different pathnames for each language, encoding, content type, or
   * charset.
   */
  headers?: readonly VaryHeader[]
}

// These headers can be used to vary the response.
export type VaryHeader =
  | keyof CommonRequestHeaders
  | 'cloudfront-viewer-country'

export interface TTLConfig {
  /**
   * Cached resources without `Cache-Control` or `Expires` header
   * will be cached for this long (in seconds).
   * @default 86400 (1 day)
   * @link https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-cachepolicy-cachepolicyconfig.html#cfn-cloudfront-cachepolicy-cachepolicyconfig-defaultttl
   */
  default?: number
  /**
   * Enforce a minimum cache time.
   * @default 0
   * @link https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-cachepolicy-cachepolicyconfig.html#cfn-cloudfront-cachepolicy-cachepolicyconfig-minttl
   */
  min?: number
  /**
   * Enforce a maximum cache time.
   * @default 31536000 (1 year)
   * @link https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-cachepolicy-cachepolicyconfig.html#cfn-cloudfront-cachepolicy-cachepolicyconfig-maxttl
   */
  max?: number
}

/**
 * Control what CloudFront forwards to your origin servers.
 */
export interface OriginRequestConfig {
  /**
   * Which HTTP cookies should be forwarded to the origin server? \
   * Note that cookies added to `vary.cookies` are forwarded automatically.
   * @default []
   */
  cookies?: readonly string[]
}
