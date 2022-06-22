import * as S3 from '@saus/aws-s3'
import { ResourceRef, useCloudFormation } from '@saus/cloudform'
import { OutputBundle } from 'saus'
import { getDeployContext, md5Hex, onDeploy } from 'saus/core'

interface Config {
  /** The GUID of the CloudFormation stack. */
  name: string
  /** The region to deploy the CloudFormation stack. */
  region: string
  /** The domain to forward uncached requests to. */
  origin: string
  /** Configure the various buckets */
  buckets?: {
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
    onDemandPages?: boolean | { expirationInDays?: number }
  }
}

export async function useS3Website(bundle: OutputBundle, config: Config) {
  const { files, bundle: bundleConfig, config: viteConfig } = getDeployContext()
  const { debugBase = '' } = bundleConfig
  const { assetsDir } = viteConfig.build

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

      const bucketConfig = config.buckets || {}

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

  type AssetList = string[]
  type ContentHash = string
  type PublicFileHashes = { [name: string]: ContentHash }

  const { buckets } = awsInfra.outputs

  const syncAssets = () => {
    const memory = files.get<AssetList>('s3-website/assets.json')
    const oldAssetNames = memory.getData() || []
    const assetNames: AssetList = []
    const uploading: Promise<any>[] = []

    return {
      upload(name: string, data: string | Buffer) {
        assetNames.push(name)

        // Assets are content-hashed, so we can bail on name alone.
        if (!oldAssetNames.includes(name)) {
          uploading.push(
            S3.putObject(config.region)({
              bucket: buckets.assets,
              key: name,
              cacheControl: 'public, max-age=2592000',
              body: data,
            })
          )
        }
      },
      async finalize() {
        await Promise.all(uploading)
        const missingAssets = oldAssetNames.filter(
          name => !assetNames.includes(name)
        )
        if (missingAssets.length)
          await S3.moveObjects(config.region)(
            buckets.assets,
            missingAssets,
            buckets.oldAssets
          )
        memory.setData(assetNames)
      },
    }
  }

  const syncPublicDir = () => {
    const memory = files.get<PublicFileHashes>('s3-website/public.json')
    const oldHashes = memory.getData() || {}
    const hashes: PublicFileHashes = {}
    const uploading: Promise<any>[] = []

    return {
      upload(name: string, data: Buffer) {
        const hash = (hashes[name] = md5Hex(data).slice(0, 8))
        const oldHash = oldHashes[name]
        if (hash !== oldHash) {
          uploading.push(
            S3.putObject(config.region)({
              bucket: buckets.publicDir,
              key: name,
              body: data,
              cacheControl: 'public, max-age=',
            })
          )
        }
      },
      /** Move old public files into the "oldAssets" bucket. */
      async finalize() {
        await Promise.all(uploading)
        const missingFiles = Object.keys(oldHashes).filter(
          name => !hashes[name]
        )
        if (missingFiles.length)
          await S3.moveObjects(config.region)(
            buckets.publicDir,
            missingFiles,
            buckets.oldAssets
          )
        memory.setData(hashes)
      },
    }
  }

  await onDeploy(async () => {
    const assetSync = syncAssets()
    const publicSync = syncPublicDir()
    for (const [name, asset] of Object.entries(bundle.clientAssets)) {
      assetSync.upload(name, asset)
    }
    for (const [name, mod] of Object.entries(bundle.clientModules)) {
      assetSync.upload(name, mod.text)
      if (debugBase && mod.debugText) {
        assetSync.upload(debugBase.slice(1) + name, mod.debugText)
      }
    }

    await Promise.all([
      assetSync.finalize(), //
      publicSync.finalize(),
    ])
  })

  return awsInfra.outputs
}

function items<T>(items: T[]) {
  return { Quantity: items.length, Items: items }
}

type Falsy = false | null | undefined | ''

function defalsify<T>(items: T[]): Exclude<T, Falsy>[] {
  return items.filter(Boolean) as any
}
