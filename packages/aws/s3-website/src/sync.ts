import * as S3 from '@saus/aws-s3'
import { OutputBundle } from 'saus'
import { md5Hex, plural, scanPublicDir } from 'saus/core'
import { DeployContext } from 'saus/deploy'
import { wrapBody } from 'saus/http'
import { WebsiteConfig } from './config'
import secrets from './secrets'

type AssetList = string[]
type ContentHash = string
type PublicFileHashes = { [name: string]: ContentHash }

export async function syncStaticFiles(
  ctx: DeployContext,
  bundle: OutputBundle,
  config: WebsiteConfig,
  buckets: { assets: string; oldAssets: string; publicDir: string }
): Promise<void> {
  const syncAssets = () => {
    const memory = ctx.files.get<AssetList>('s3-website/assets.json')
    const oldAssetNames = memory.getData() || []
    const assetNames: AssetList = []
    const uploading: Promise<any>[] = []

    return {
      upload(name: string, data: string | Buffer) {
        assetNames.push(name)
        if (ctx.dryRun) {
          return
        }
        // Assets are content-hashed, so we can bail on name alone.
        if (!oldAssetNames.includes(name)) {
          uploading.push(
            S3.putObject(config.region)({
              bucket: buckets.assets,
              key: name,
              cacheControl: 's-maxage=2592000, immutable',
              body: wrapBody(data),
              creds: secrets,
            })
          )
        }
      },
      async finalize() {
        memory.setData(assetNames.sort())

        if (uploading.length)
          await ctx.logPlan(
            `upload ${plural(uploading.length, 'client asset')}`,
            () => Promise.all(uploading)
          )

        // Old client assets are moved to a S3 bucket that deletes
        // each file after 2 days.
        const missingAssets = oldAssetNames.filter(
          name => !assetNames.includes(name)
        )
        if (missingAssets.length)
          await ctx.logPlan(
            `expire ${plural(uploading.length, 'old client asset')}`,
            () =>
              S3.moveObjects(config.region)({
                keys: missingAssets,
                bucket: buckets.assets,
                newBucket: buckets.oldAssets,
                creds: secrets,
              })
          )
      },
    }
  }

  const syncPublicDir = () => {
    const memory = ctx.files.get<PublicFileHashes>('s3-website/public.json')
    const oldHashes = memory.getData() || {}
    const hashes: PublicFileHashes = {}
    const uploading: Promise<any>[] = []

    const cacheControl =
      config.publicDir?.cacheControl || 's-maxage=315360000, immutable'

    return {
      upload(name: string, data: Buffer) {
        const hash = (hashes[name] = md5Hex(data).slice(0, 8))
        if (ctx.dryRun) {
          return
        }
        const oldHash = oldHashes[name]
        if (hash !== oldHash) {
          uploading.push(
            S3.putObject(config.region)({
              bucket: buckets.publicDir,
              key: name,
              body: wrapBody(data),
              cacheControl,
              creds: secrets,
            })
          )
        }
      },
      async finalize() {
        memory.setData(hashes)

        if (uploading.length)
          await ctx.logPlan(
            `upload ${plural(uploading.length, 'public file')}`,
            () => Promise.all(uploading)
          )

        // Files removed from the public directory are deleted from S3.
        const oldFiles = Object.keys(oldHashes).filter(name => !hashes[name])
        if (oldFiles.length)
          await ctx.logPlan(
            `delete ${plural(uploading.length, 'old public file')}`,
            () =>
              S3.deleteObjects(config.region)({
                delete: {
                  objects: oldFiles.map(key => ({ key })),
                },
                bucket: buckets.publicDir,
                creds: secrets,
              })
          )
      },
    }
  }

  const assetStore = syncAssets()
  for (const asset of bundle.clientAssets) {
    assetStore.upload(asset.fileName, Buffer.from(asset.source))
  }
  for (const chunk of bundle.clientChunks) {
    assetStore.upload(chunk.fileName, chunk.code)
  }

  const publicStore = syncPublicDir()
  const publicDir = await scanPublicDir(ctx)
  if (publicDir) {
    await publicDir.commit('cache')
    for (const [name, file] of Object.entries(publicDir.cache)) {
      publicStore.upload(name, file)
    }
  }

  await Promise.all([
    assetStore.finalize(), //
    publicStore.finalize(),
  ])
}
