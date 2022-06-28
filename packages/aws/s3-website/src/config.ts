import { BrotliConfig, CachePolicyConfig, PrefixOrigin } from './types'

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
  caching?: CachePolicyConfig
  /**
   * Which HTTP cookies should be forwarded to the origin server?
   * @default []
   */
  cookies?: string[]
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
  prefixOrigins?: PrefixOrigin[]
  /**
   * By default, static assets are compressed with Brotli.
   *
   * Set `false` to disable this compression.
   */
  brotli?: false | BrotliConfig
  /** Configure the various buckets */
  buckets?: WebsiteBucketConfig
}

export interface WebsiteBucketConfig {
  /**
   * Enable a bucket for hosting pre-rendered pages. \
   * This bucket must be populated manually.
   */
  popularPages?: boolean
  /**
   * Enable a bucket that acts as an indefinite cache for
   * pages generated just-in-time. This is perfect for reducing
   * load on the origin server.
   *
   * This bucket must be populated manually.
   */
  onDemandPages?:
    | boolean
    | {
        /** @default 1 */
        expirationInDays?: number
      }
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
  publicDir?: { cacheControl?: string }
}
