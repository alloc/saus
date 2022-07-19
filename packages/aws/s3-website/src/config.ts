import {
  BrotliConfig,
  OriginOverride,
  OriginRequestConfig,
  TTLConfig,
  VaryConfig,
} from './types'

export interface WebsiteConfig {
  /** The GUID of the CloudFormation stack. */
  name: string
  /** The region to deploy the CloudFormation stack. */
  region: string
  /** The domain to forward uncached requests to. */
  origin: string
  /**
   * How to cache responses from S3 or your origin server.
   * Static client modules are unaffected.
   */
  ttl?: TTLConfig
  /**
   * Control which requests are capable of producing different
   * responses based on the request headers. \
   * These varying responses are cached by CloudFront separately.
   */
  vary?: VaryConfig
  /**
   * Control what's forwarded to your origin servers.
   */
  forward?: OriginRequestConfig
  /**
   * CloudFront can inject a set of common security-focused headers
   * (eg: for XSS protection) into every response.
   * @link https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-response-headers-policies.html#managed-response-headers-policies-security
   */
  injectSecurityHeaders?: boolean
  /**
   * Additional origin servers that only respond to a specific
   * pathname prefix.
   *
   * Take this for example…
   *
   *     api: "123.vercel.app"
   *
   * It would forward `/api/*` requests to your Vercel functions
   * at `123.vercel.app/api/*` and rewrite to HTTPS.
   */
  overrides?: OriginOverride[]
  /**
   * By default, static assets are compressed with Brotli.
   *
   * Set `false` to disable this compression.
   */
  brotli?: false | BrotliConfig
  /**
   * This option affects the `PublicDir` S3 bucket.
   *
   * Override the default `Cache-Control` header used by every
   * file found in the `publicDir` bucket.
   *
   * Defaults to 1 year max in shared cache and immutable in
   * browser cache.
   *
   * @default "s-maxage=315360000, immutable"
   */
  publicDir?: {
    cacheControl?: string
  }
}
