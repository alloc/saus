import { ResourceRef, useCloudFormation } from '@saus/cloudform'
import { OutputBundle } from 'saus'
import { getDeployContext } from 'saus/deploy'
import { useBundleSync } from './sync'
import { WebsiteConfig } from './types'

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
      // This bucket mirrors the ./public/ folder of your project.
      const publicDir = ref(
        'PublicDir',
        new aws.S3.Bucket({
          AccessControl: 'PublicRead',
        })
      )

      // This bucket holds the content-hashed modules that are
      // loaded by the browser for client-side logic.
      const assets = ref(
        'LatestAssets',
        new aws.S3.Bucket({
          AccessControl: 'PublicRead',
        })
      )

      // When a new project version is deployed, this bucket is
      // where the old assets are moved to. They are kept alive
      // for 48 hours to avoid interrupting user sessions.
      const oldAssets = ref(
        'OldAssets',
        new aws.S3.Bucket({
          AccessControl: 'PublicRead',
          LifecycleConfiguration: {
            Rules: [{ Status: 'Enabled', ExpirationInDays: 2 }],
          },
        })
      )

      // This bucket holds pre-rendered pages, which tend to be
      // the most popular pages (hence the name).
      const popularPages =
        bucketConfig.popularPages &&
        ref(
          'PopularPages',
          new aws.S3.Bucket({
            AccessControl: 'PublicRead',
          })
        )

      // This bucket holds pages rendered just-in-time. This reduces
      // load on the origin server for often requested dynamic pages.
      const onDemandPages =
        bucketConfig.onDemandPages &&
        ref(
          'OnDemandPages',
          new aws.S3.Bucket({
            AccessControl: 'PublicRead',
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
        )

      const httpsOnly = {
        HTTPSPort: 443,
        OriginProtocolPolicy: 'https-only',
      }

      type Origin = InstanceType<typeof aws.CloudFront.Distribution.Origin>
      type OriginGroup = InstanceType<
        typeof aws.CloudFront.Distribution.OriginGroup
      >

      const BucketOrigin = (
        bucket: ResourceRef,
        extra?: Partial<Origin>
      ): Origin => ({
        Id: bucket.id,
        DomainName: bucket.get('DomainName'),
        CustomOriginConfig: httpsOnly,
        ...extra,
      })

      const OriginGroup = (
        primaryOriginId: string,
        secondOriginId: string
      ): OriginGroup => ({
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
      const pageServer: Origin = {
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

      const edgeCache = ref(
        'EdgeCache',
        new aws.CloudFront.Distribution({
          DistributionConfig: {
            Enabled: true,
            Origins: origins,
            OriginGroups: items(originGroups),
            CacheBehaviors: defalsify([
              {
                ViewerProtocolPolicy: 'redirect-to-https',
                TargetOriginId: assets.id,
                PathPattern: assetsDir + '/*',
              },
              debugBase && {
                ViewerProtocolPolicy: 'redirect-to-https',
                TargetOriginId: assets.id,
                PathPattern: debugBase.slice(1) + assetsDir + '/*',
              },
            ]),
            DefaultCacheBehavior: {
              ViewerProtocolPolicy: 'redirect-to-https',
              TargetOriginId: publicDir.id,
            },
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

  await useBundleSync(
    bundle,
    ctx.files,
    config,
    awsInfra.outputs.buckets,
    debugBase
  )

  return {
    ...awsInfra.outputs,
    awsRegion: config.region,
  }
}

function items<T>(items: T[]) {
  return { Quantity: items.length, Items: items }
}

type Falsy = false | null | undefined | ''

function defalsify<T>(items: T[]): Exclude<T, Falsy>[] {
  return items.filter(Boolean) as any
}
