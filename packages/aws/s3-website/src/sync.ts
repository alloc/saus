import * as S3 from '@saus/aws-s3'
import { cachedPublicFiles, OutputBundle } from 'saus'
import { md5Hex, plural } from 'saus/core'
import { createDryLog, getDeployContext, GitFiles } from 'saus/deploy'
import secrets from './secrets'
import { WebsiteConfig } from './types'

type AssetList = string[]
type ContentHash = string
type PublicFileHashes = { [name: string]: ContentHash }

const dryLog = createDryLog('@saus/aws-s3-website')

export async function syncStaticFiles(
  bundle: OutputBundle,
  files: GitFiles,
  config: WebsiteConfig,
  buckets: { assets: string; oldAssets: string; publicDir: string },
  debugBase: string
): Promise<void> {
  const context = getDeployContext()
  const bucketConfig = config.buckets || {}

  const syncAssets = () => {
    const memory = files.get<AssetList>('s3-website/assets.json')
    const oldAssetNames = memory.getData() || []
    const assetNames: AssetList = []
    const uploading: Promise<any>[] = []

    return {
      upload(name: string, data: string | Buffer) {
        assetNames.push(name)
        if (context.dryRun) {
          return
        }
        // Assets are content-hashed, so we can bail on name alone.
        if (!oldAssetNames.includes(name)) {
          uploading.push(
            S3.putObject(config.region)({
              bucket: buckets.assets,
              key: name,
              cacheControl: 's-maxage=2592000, immutable',
              body: data,
              creds: secrets,
            })
          )
        }
      },
      async finalize() {
        if (context.dryRun) {
          dryLog(`would upload ${plural(assetNames.length, 'asset')}`)
        } else {
          await Promise.all(uploading)
          const missingAssets = oldAssetNames.filter(
            name => !assetNames.includes(name)
          )
          if (missingAssets.length)
            await S3.moveObjects(config.region)({
              keys: missingAssets,
              bucket: buckets.assets,
              newBucket: buckets.oldAssets,
              creds: secrets,
            })

          memory.setData(assetNames)
        }
      },
    }
  }

  const syncPublicDir = () => {
    const memory = files.get<PublicFileHashes>('s3-website/public.json')
    const oldHashes = memory.getData() || {}
    const hashes: PublicFileHashes = {}
    const uploading: Promise<any>[] = []

    const cacheControl =
      bucketConfig.publicDir?.cacheControl || 's-maxage=315360000, immutable'

    return {
      upload(name: string, data: Buffer) {
        const hash = (hashes[name] = md5Hex(data).slice(0, 8))
        if (context.dryRun) {
          return
        }
        const oldHash = oldHashes[name]
        if (hash !== oldHash) {
          uploading.push(
            S3.putObject(config.region)({
              bucket: buckets.publicDir,
              key: name,
              body: data,
              cacheControl,
              creds: secrets,
            })
          )
        }
      },
      /** Move old public files into the "oldAssets" bucket. */
      async finalize() {
        if (context.dryRun) {
          dryLog(
            `would upload ${plural(Object.keys(hashes).length, 'public file')}`
          )
        } else {
          await Promise.all(uploading)
          const missingFiles = Object.keys(oldHashes).filter(
            name => !hashes[name]
          )
          if (missingFiles.length)
            await S3.moveObjects(config.region)({
              keys: missingFiles,
              bucket: buckets.publicDir,
              newBucket: buckets.oldAssets,
              creds: secrets,
            })

          memory.setData(hashes)
        }
      },
    }
  }

  const assetStore = syncAssets()
  for (const [name, asset] of Object.entries(bundle.clientAssets)) {
    assetStore.upload(name, asset)
  }
  for (const [name, mod] of Object.entries(bundle.clientModules)) {
    assetStore.upload(name, mod.text)
    if (debugBase && mod.debugText) {
      assetStore.upload(debugBase.slice(1) + name, mod.debugText)
    }
  }

  const publicStore = syncPublicDir()
  const publicFiles = cachedPublicFiles.get(bundle)
  if (publicFiles) {
    for (const [name, file] of Object.entries(publicFiles)) {
      publicStore.upload(name, file)
    }
  }

  await Promise.all([
    assetStore.finalize(), //
    publicStore.finalize(),
  ])
}
