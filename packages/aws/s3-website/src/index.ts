import { CloudFront, ResourceRef, S3, useCloudFormation } from '@saus/cloudform'
import { OutputBundle } from 'saus'
import { addSecrets, getDeployContext, onDeploy } from 'saus/deploy'
import { WebsiteConfig } from './config'
import secrets from './secrets'
import { syncStaticFiles } from './sync'
import { varyByDevice } from './varyByDevice'

addSecrets(useS3Website, secrets)
addSecrets(useS3Website, [useCloudFormation])

export async function useS3Website(
  bundle: OutputBundle,
  config: WebsiteConfig
) {
  const ctx = getDeployContext()
  const { debugBase = '' } = ctx.bundle
  const { assetsDir } = ctx.config.build
  const bucketConfig = config.buckets || {}

  const awsInfra = await useCloudFormation({
    name: config.name,
    region: config.region,
    template(ref, aws) {
      const createBucket = (
        id: string,
        props?: ConstructorParameters<typeof S3.Bucket>[0]
      ): ResourceRef => {
        const bucket = ref(id, new aws.S3.Bucket(props))
        ref(
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

      // This bucket mirrors the ./public/ folder of your project.
      const publicDir = createWebsiteBucket('PublicDir')

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

      // This bucket holds pre-rendered pages, which tend to be
      // the most popular pages (hence the name).
      const popularPages =
        bucketConfig.popularPages && createWebsiteBucket('PopularPages')

      // This bucket holds pages rendered just-in-time. This reduces
      // load on the origin server for often requested dynamic pages.
      const onDemandPages =
        bucketConfig.onDemandPages &&
        createWebsiteBucket('OnDemandPages', {
          LifecycleConfiguration: {
            Rules: [
              {
                Status: 'Enabled',
                ExpirationInDays:
                  typeof bucketConfig.onDemandPages == 'object'
                    ? bucketConfig.onDemandPages.expirationInDays
                    : 1,
              },
            ],
          },
        })

      const httpsOnly = {
        HTTPSPort: 443,
        OriginProtocolPolicy: 'https-only',
      }

      type OriginConfig = CloudFront.Distribution.Origin

      const BucketOrigin = (
        bucket: ResourceRef,
        extra?: Partial<OriginConfig>
      ): OriginConfig => ({
        Id: bucket.id,
        DomainName: websiteBuckets.has(bucket)
          ? aws.Fn.Select(1, aws.Fn.Split('://', bucket.get('WebsiteURL')))
          : bucket.get('RegionalDomainName'),
        CustomOriginConfig: httpsOnly,
        ...extra,
      })

      const OriginGroup = (
        primaryOriginId: string,
        secondOriginId: string
      ): CloudFront.Distribution.OriginGroup => ({
        Id: primaryOriginId + '-404',
        FailoverCriteria: { StatusCodes: items([404]) },
        Members: items([
          { OriginId: primaryOriginId },
          { OriginId: secondOriginId },
        ]),
      })

      const OriginGroupChain = (...originIds: (string | Falsy)[]) =>
        defalsify(
          defalsify(originIds).map(
            (originId, i, originIds) =>
              i > 0 && OriginGroup(originIds[i - 1], originId)
          )
        )

      const pageServerId = 'PageServer'
      const pageServer: OriginConfig = {
        Id: pageServerId,
        DomainName: config.origin,
        CustomOriginConfig: httpsOnly,
      }

      const origins = defalsify([
        BucketOrigin(assets),
        BucketOrigin(oldAssets),
        BucketOrigin(publicDir),
        popularPages && BucketOrigin(popularPages),
        onDemandPages && BucketOrigin(onDemandPages),
        pageServer,
      ])

      const originGroups = defalsify([
        OriginGroup(assets.id, oldAssets.id),
        ...OriginGroupChain(
          publicDir.id,
          popularPages && popularPages.id,
          onDemandPages && onDemandPages.id,
          pageServerId
        ),
      ])

      const defaultCachePolicy = ref(
        'DefaultCachePolicy',
        new aws.CloudFront.CachePolicy({
          CachePolicyConfig: {
            Name: 'DefaultCachePolicy',
            ParametersInCacheKeyAndForwardedToOrigin: {
              CookiesConfig: {
                CookieBehavior: config.cookies?.length ? 'whitelist' : 'none',
                Cookies: config.cookies,
              },
              HeadersConfig: {
                HeaderBehavior: 'whitelist',
                Headers: [
                  'If-Modified-Since',
                  'If-None-Match',
                  'Origin',
                  ...varyByDevice(config.caching?.varyByDevice),
                ],
              },
              QueryStringsConfig: {
                QueryStringBehavior: 'all',
              },
              EnableAcceptEncodingGzip: false,
              EnableAcceptEncodingBrotli: false,
            },
            MinTTL: config.caching?.minTTL ?? 0,
            DefaultTTL: config.caching?.defaultTTL ?? 86400,
            MaxTTL: config.caching?.maxTTL ?? 31536000,
          },
        })
      )

      type CacheBehavior = CloudFront.Distribution.CacheBehavior

      const CacheBehavior = (
        target: string | ResourceRef,
        props: Omit<CacheBehavior, 'ViewerProtocolPolicy' | 'TargetOriginId'>
      ): CacheBehavior => ({
        TargetOriginId: typeof target !== 'string' ? target.id : target,
        CachePolicyId: defaultCachePolicy,
        ViewerProtocolPolicy:
          typeof target !== 'string' && websiteBuckets.has(target)
            ? 'allow-all'
            : 'redirect-to-https',
        OriginRequestPolicyId: managedRequestPolicies.AllViewer,
        ResponseHeadersPolicyId: config.injectSecurityHeaders
          ? managedResponseHeaderPolicies.SecurityHeaders
          : undefined,
        ...props,
      })

      const cacheBehaviors: CacheBehavior[] = defalsify([
        CacheBehavior(assets, {
          PathPattern: assetsDir + '/*',
          CachePolicyId: managedCachePolicies.CachingOptimized,
        }),
        debugBase &&
          CacheBehavior(assets, {
            PathPattern: debugBase.slice(1) + assetsDir + '/*',
            CachePolicyId: managedCachePolicies.CachingOptimized,
          }),
      ])

      config.prefixOrigins?.forEach(origin => {
        const [, DomainName, OriginPath] = /^([^/]+)(\/.+)?$/.exec(
          origin.origin
        )!
        origins.push({
          Id: origin.origin,
          DomainName,
          OriginPath,
          CustomOriginConfig: httpsOnly,
        })
        cacheBehaviors.push(
          CacheBehavior(origin.origin, {
            PathPattern: origin.prefix + '/*',
            CachePolicyId: origin.noCache
              ? managedCachePolicies.CachingDisabled
              : defaultCachePolicy,
          })
        )
      })

      const edgeCache = ref(
        'EdgeCache',
        new aws.CloudFront.Distribution({
          DistributionConfig: {
            Enabled: true,
            Origins: origins,
            OriginGroups: items(originGroups),
            CacheBehaviors: cacheBehaviors,
            DefaultCacheBehavior: CacheBehavior(publicDir, {
              PathPattern: undefined!,
            }),
          },
        })
      )

      edgeCache.dependsOn(publicDir, assets, oldAssets)
      popularPages && edgeCache.dependsOn(popularPages)
      onDemandPages && edgeCache.dependsOn(onDemandPages)

      return {
        edgeCacheUrl: edgeCache.get<string>('DomainName'),
        buckets: {
          assets,
          oldAssets,
          popularPages: popularPages || undefined,
          onDemandPages: onDemandPages || undefined,
          publicDir,
        },
      }
    },
  })

  await onDeploy(async () => {
    await syncStaticFiles(
      bundle,
      ctx.files,
      config,
      awsInfra.outputs.buckets || {}
    )
  })

  return {
    ...awsInfra.outputs,
    awsRegion: config.region,
  }
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
