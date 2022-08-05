import {
  CloudFront,
  isResourceRef,
  ResourceRef,
  S3,
  useCloudFormation,
  Value,
} from '@saus/cloudform'
import { relative } from 'path'
import { OutputBundle } from 'saus'
import { addSecrets, getDeployContext, onDeploy } from 'saus/deploy'
import { normalizeHeaderKeys } from 'saus/http'
import { WebsiteConfig } from './config'
import secrets from './secrets'
import { syncStaticFiles } from './sync'
import { varyByDevice } from './varyByDevice'

addSecrets(deployWebsiteToS3, secrets)
addSecrets(deployWebsiteToS3, [useCloudFormation])

export async function deployWebsiteToS3(
  bundle: OutputBundle,
  config: WebsiteConfig
) {
  const ctx = getDeployContext()
  const { debugBase = '' } = ctx.bundle
  const { assetsDir } = ctx.config.build

  const awsInfra = await useCloudFormation({
    name: config.name,
    region: config.region,
    template(ref, aws) {
      const buckets = new Set<ResourceRef>()
      const createBucket = (
        id: string,
        props?: ConstructorParameters<typeof S3.Bucket>[0]
      ): ResourceRef => {
        const bucket = ref(id, new aws.S3.Bucket(props))
        const bucketPolicy = ref(
          id + 'BucketPolicy',
          new aws.S3.BucketPolicy({
            Bucket: bucket,
            // https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-policy-language-overview.html
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                {
                  Effect: 'Allow',
                  Action: ['s3:GetObject'],
                  Resource: [aws.Fn.Join('/', [bucket.get('Arn'), '*'])],
                  Principal: '*',
                },
              ],
            },
          })
        )
        buckets.add(bucket)
        bucketPolicy.dependsOn(bucket)
        return bucket
      }

      const websiteBuckets = new Set<ResourceRef>()
      const createWebsiteBucket = (
        id: string,
        props?: ConstructorParameters<typeof S3.Bucket>[0]
      ) => {
        const bucket = createBucket(id, {
          ...props,
          WebsiteConfiguration: {
            IndexDocument: 'index.html',
            ...props?.WebsiteConfiguration,
          },
        })
        websiteBuckets.add(bucket)
        return bucket
      }

      // This bucket holds the content-hashed modules that are
      // loaded by the browser for client-side logic.
      const assets = createBucket('LatestAssets')

      // When a new project version is deployed, this bucket is
      // where the old assets are moved to. They are kept alive
      // for 48 hours to avoid interrupting user sessions.
      const oldAssets = createBucket('OldAssets', {
        LifecycleConfiguration: {
          Rules: [{ Status: 'Enabled', ExpirationInDays: 2 }],
        },
      })

      // When an S3 bucket is configured in website mode,
      // it must be connected through HTTP only.
      const httpOnly = {
        HTTPPort: 80,
        OriginProtocolPolicy: 'http-only',
      }

      type OriginConfig = CloudFront.Distribution.Origin

      const BucketOrigin = (
        bucket: ResourceRef,
        extra?: Partial<OriginConfig>
      ): OriginConfig => {
        if (websiteBuckets.has(bucket)) {
          return {
            Id: bucket.id,
            DomainName: aws.Fn.Select(
              1,
              aws.Fn.Split('://', bucket.get('WebsiteURL'))
            ),
            CustomOriginConfig: httpOnly,
            ...extra,
          }
        }
        return {
          Id: bucket.id,
          DomainName: bucket.get('RegionalDomainName'),
          S3OriginConfig: { OriginAccessIdentity: '' },
          ...extra,
        }
      }

      const OriginFailover = (
        primaryOriginId: string,
        secondOriginId: Value<string>
      ): CloudFront.Distribution.OriginGroup => ({
        Id: primaryOriginId + 'Failover',
        FailoverCriteria: { StatusCodes: items([404, 403]) },
        Members: items([
          { OriginId: primaryOriginId },
          { OriginId: secondOriginId },
        ]),
      })

      const originGroups: CloudFront.Distribution.OriginGroup[] = []
      const defineOriginGroup = (
        primaryOriginId: string,
        secondOriginId: Value<string>
      ): CloudFront.Distribution.OriginGroup => {
        const originGroup = OriginFailover(primaryOriginId, secondOriginId)
        originGroups.push(originGroup)
        return originGroup
      }

      const varyHeaders = normalizeHeaderKeys([
        ...(config.vary?.headers || []),
        ...varyByDevice(config.vary?.device),
      ])

      const CookiesConfig = (cookies: readonly string[] | undefined) => ({
        CookieBehavior: cookies ? 'whitelist' : 'none',
        Cookies: cookies as string[],
      })

      const defaultCachePolicy = ref(
        'DefaultCachePolicy',
        new aws.CloudFront.CachePolicy({
          CachePolicyConfig: {
            Name: 'DefaultCachePolicy',
            ParametersInCacheKeyAndForwardedToOrigin: {
              CookiesConfig: CookiesConfig(config.vary?.cookies),
              HeadersConfig: {
                HeaderBehavior: varyHeaders.length ? 'whitelist' : 'none',
                Headers: varyHeaders.length ? varyHeaders : undefined,
              },
              QueryStringsConfig: {
                QueryStringBehavior: 'all',
              },
              EnableAcceptEncodingGzip: false,
              EnableAcceptEncodingBrotli: false,
            },
            MinTTL: config.ttl?.min ?? 0,
            DefaultTTL: config.ttl?.default ?? 86400,
            MaxTTL: config.ttl?.max ?? 31536000,
          },
        })
      )

      /**
       * Requests to Amazon web services need to omit the "Host" header
       * to avoid S3's virtual hosting and CloudFront's alternate domain
       * name enforcement.
       */
      const awsOriginRequestPolicy = ref(
        'AWSOriginRequestPolicy',
        new aws.CloudFront.OriginRequestPolicy({
          OriginRequestPolicyConfig: {
            Name: 'AWSOriginRequestPolicy',
            CookiesConfig: CookiesConfig(config.forward?.cookies),
            HeadersConfig: {
              HeaderBehavior: 'whitelist',
              // Note that any headers included in the CachePolicy
              // are included in this array automatically.
              Headers: ['referer'],
            },
            QueryStringsConfig: {
              QueryStringBehavior: 'all',
            },
          },
        })
      )

      type CacheBehavior = CloudFront.Distribution.CacheBehavior

      const CacheBehavior = (
        target: Value<string> | ResourceRef,
        props: Omit<CacheBehavior, 'ViewerProtocolPolicy' | 'TargetOriginId'> &
          Partial<Pick<CacheBehavior, 'ViewerProtocolPolicy'>>
      ): CacheBehavior => ({
        TargetOriginId: isResourceRef(target) ? target.id : target,
        CachePolicyId: defaultCachePolicy,
        CachedMethods: getAllowedMethods('readOnly'),
        AllowedMethods: getAllowedMethods('readOnly'),
        // Avoid using HTTPS since it costs more.
        // @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ChargesForHTTPSConnections.html
        ViewerProtocolPolicy: 'allow-all',
        OriginRequestPolicyId: awsOriginRequestPolicy,
        ResponseHeadersPolicyId: config.injectSecurityHeaders
          ? managedResponseHeaderPolicies.SecurityHeaders
          : undefined,
        ...props,
      })

      const DefaultCacheBehavior = (
        target: Value<string> | ResourceRef,
        props?: Omit<
          CacheBehavior,
          'PathPattern' | 'ViewerProtocolPolicy' | 'TargetOriginId'
        >
      ): CacheBehavior =>
        CacheBehavior(target, {
          ...props,
          PathPattern: undefined!,
        })

      const pageServerId = 'PageServer'
      const pageServer: OriginConfig = {
        Id: pageServerId,
        DomainName: config.origin,
        CustomOriginConfig: config.httpsOnly
          ? { HTTPSPort: 443, OriginProtocolPolicy: 'https-only' }
          : {
              HTTPPort: 80,
              HTTPSPort: 443,
              OriginProtocolPolicy: 'match-viewer',
            },
      }

      const httpVersion = 'http' + (config.httpVersion || 1.1)

      const pageStore = createWebsiteBucket('PageStore')
      const pageStoreFailover = OriginFailover(pageStore.id, pageServerId)
      const pageStoreCache = ref(
        'PageStoreCache',
        new aws.CloudFront.Distribution({
          DistributionConfig: {
            Comment: 'Pages and data served by the PageServer',
            Enabled: true,
            Origins: [BucketOrigin(pageStore), pageServer],
            OriginGroups: items([pageStoreFailover]),
            DefaultCacheBehavior: DefaultCacheBehavior(pageStoreFailover.Id),
            HttpVersion: httpVersion,
          },
        })
      )

      // This bucket mirrors the ./public/ folder of your project.
      const publicDir = createWebsiteBucket('PublicDir')
      const publicDirCache = ref(
        'PublicDirCache',
        new aws.CloudFront.Distribution({
          DistributionConfig: {
            Comment: `Files from the ./${relative(
              ctx.root,
              ctx.config.publicDir
            )}/ folder`,
            Enabled: true,
            Origins: [BucketOrigin(publicDir)],
            DefaultCacheBehavior: DefaultCacheBehavior(publicDir.id),
          },
        })
      )

      const origins = defalsify([
        BucketOrigin(assets),
        BucketOrigin(oldAssets),
        {
          Id: publicDirCache.id,
          DomainName: publicDirCache.get('DomainName'),
          CustomOriginConfig: httpOnly,
        },
        {
          Id: pageStoreCache.id,
          DomainName: pageStoreCache.get('DomainName'),
          CustomOriginConfig: httpOnly,
        },
      ])

      const assetsGroup = defineOriginGroup(assets.id, oldAssets.id)
      const defaultOrigin = defineOriginGroup(
        publicDirCache.id,
        pageStoreCache.id
      )

      const cacheBehaviors: CacheBehavior[] = defalsify([
        CacheBehavior(assetsGroup.Id, {
          PathPattern: assetsDir + '/*',
          CachePolicyId: managedCachePolicies.CachingOptimized,
        }),
        debugBase &&
          CacheBehavior(assetsGroup.Id, {
            PathPattern: debugBase.slice(1) + assetsDir + '/*',
            CachePolicyId: managedCachePolicies.CachingDisabled,
          }),
      ])

      config.overrides?.forEach(origin => {
        const parsedOrigin = /^([^/]+)(\/.+)?$/.exec(origin.origin)!
        if (parsedOrigin[1] !== config.origin)
          origins.push({
            Id: origin.origin,
            DomainName: parsedOrigin[1],
            OriginPath: parsedOrigin[2],
            CustomOriginConfig: origin.httpsOnly
              ? { HTTPSPort: 443, OriginProtocolPolicy: 'https-only' }
              : httpOnly,
          })

        const paths = Array.isArray(origin.path) ? origin.path : [origin.path]
        for (let path of paths) {
          if (!path.includes('*') && path.indexOf('.') <= 0) {
            path += '/*'
          }
          cacheBehaviors.push(
            CacheBehavior(origin.origin, {
              PathPattern: path,
              AllowedMethods: getAllowedMethods(origin.httpMethods || 'all'),
              CachePolicyId: origin.noCache
                ? managedCachePolicies.CachingDisabled
                : defaultCachePolicy,
              OriginRequestPolicyId:
                origin.requestPolicy == 'allViewer'
                  ? managedRequestPolicies.AllViewer
                  : awsOriginRequestPolicy,
              ViewerProtocolPolicy: origin.httpsOnly
                ? 'https-only'
                : 'allow-all',
            })
          )
        }
      })

      const assetCache = ref(
        'EdgeStatic',
        new aws.CloudFront.Distribution({
          DistributionConfig: {
            Comment: 'Point your domain to this distribution',
            Enabled: true,
            Origins: origins,
            OriginGroups: items(originGroups),
            CacheBehaviors: cacheBehaviors,
            DefaultCacheBehavior: DefaultCacheBehavior(defaultOrigin.Id, {
              CachePolicyId: managedCachePolicies.CachingDisabled,
            }),
            HttpVersion: httpVersion,
            Aliases:
              config.alias && config.acm
                ? [config.alias, '*.' + config.alias]
                : undefined,
            ViewerCertificate: config.acm && {
              AcmCertificateArn: config.acm.certificateArn,
              SslSupportMethod: 'sni-only',
            },
          },
        })
      )

      assetCache.dependsOn(
        assets,
        oldAssets,
        publicDirCache.dependsOn(
          publicDir,
          defaultCachePolicy,
          awsOriginRequestPolicy
        ),
        pageStoreCache.dependsOn(
          pageStore,
          defaultCachePolicy,
          awsOriginRequestPolicy
        )
      )

      return {
        /** The `alias` option, or an empty string */
        alias: config.alias || '',
        /** The domain name of the front-facing CloudFront distribution */
        domain: assetCache.get<string>('DomainName'),
        /**
         * Identifiers for internal CloudFront distributions.
         *
         * These are useful for cache invalidation.
         */
        caches: {
          pageStore: pageStoreCache,
          publicDir: publicDirCache,
        },
        /** Bucket names for S3 storage */
        buckets: {
          /**
           * The generated JS/CSS/etc for the latest client bundle.
           */
          assets,
          /**
           * When your client bundle is updated, this bucket is where the old
           * assets from the previous bundle are stored. They are automatically
           * deleted after 48 hours.
           */
          oldAssets,
          /**
           * The assets found in your `publicDir` directory are
           * stored here to be served by the CloudFront distribution.
           */
          publicDir,
          /**
           * Your origin server will upload pages and state modules to
           * this bucket if you call the `setupPageStore` function in
           * your routes module.
           *
           * The `@saus/page-store` package has more info.
           */
          pageStore,
        },
      }
    },
  })

  await onDeploy({
    name: '@saus/aws-s3-website',
    run: ctx =>
      syncStaticFiles(ctx, bundle, config, awsInfra.outputs.buckets || {}),
  })

  return {
    ...awsInfra.outputs,
    awsRegion: config.region,
    origin: config.origin,
  }
}

function getAllowedMethods(httpMethods: 'readOnly' | 'all') {
  return httpMethods == 'all'
    ? ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE']
    : ['GET', 'HEAD', 'OPTIONS']
}

const managedCachePolicies = {
  CachingDisabled: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
  CachingOptimized: '658327ea-f89d-4fab-a63d-7e88639e58f6',
}

const managedRequestPolicies = {
  AllViewer: '216adef6-5c7f-47e4-b989-5492eafa07d3',
}

const managedResponseHeaderPolicies = {
  SecurityHeaders: '67f7725c-6f97-4210-82d7-5512b31e9d03',
}

function items<T>(items: T[]) {
  return { Quantity: items.length, Items: items }
}

type Falsy = false | null | undefined | ''

function defalsify<T>(items: T[]): Exclude<T, Falsy>[] {
  return items.filter(Boolean) as any
}
