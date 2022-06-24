import * as S3 from '@saus/aws-s3'
import { cachedPublicFiles, OutputBundle } from 'saus'
import { GitFiles, md5Hex, onDeploy } from 'saus/core'
import { WebsiteConfig } from './types'

type AssetList = string[]
type ContentHash = string
type PublicFileHashes = { [name: string]: ContentHash }

export async function useBundleSync(
  bundle: OutputBundle,
  files: GitFiles,
  config: WebsiteConfig,
  buckets: { assets: string; oldAssets: string; publicDir: string },
  debugBase: string
): Promise<void> {
  const bucketConfig = config.buckets || {}

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
              cacheControl: 's-maxage=2592000, immutable',
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

    const cacheControl =
      bucketConfig.publicDir?.cacheControl || 's-maxage=315360000, immutable'

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
              cacheControl,
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
  })
}
