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
    const uploads = createUploader(ctx)

    return {
      upload(name: string, data: string | Buffer) {
        assetNames.push(name)
        if (ctx.dryRun) {
          return
        }
        // Assets are content-hashed, so we can bail on name alone.
        if (!oldAssetNames.includes(name)) {
          uploads.add(name, () =>
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

        if (uploads.length)
          await ctx.logPlan(
            `upload ${plural(uploads.length, 'client asset')}`,
            () => uploads
          )

        // Old client assets are moved to a S3 bucket that deletes
        // each file after 2 days.
        const missingAssets = oldAssetNames.filter(
          name => !assetNames.includes(name)
        )
        if (missingAssets.length)
          await ctx.logPlan(
            `expire ${plural(missingAssets.length, 'old client asset')}`,
            createRetryable({
              shouldRetry,
              delay(tries) {
                const delaySecs = Math.pow(2, tries)
                ctx.logActivity(
                  'retrying moveObjects call in %d seconds (attempt %d)',
                  delaySecs,
                  tries
                )
                return delaySecs
              },
              action: () =>
                S3.moveObjects(config.region)({
                  keys: missingAssets,
                  bucket: buckets.assets,
                  newBucket: buckets.oldAssets,
                  creds: secrets,
                }),
            })
          )
      },
    }
  }

  const syncPublicDir = () => {
    const memory = ctx.files.get<PublicFileHashes>('s3-website/public.json')
    const oldHashes = memory.getData() || {}
    const hashes: PublicFileHashes = {}
    const uploads = createUploader(ctx)

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
          uploads.add(name, () =>
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

        if (uploads.length)
          await ctx.logPlan(
            `upload ${plural(uploads.length, 'public file')}`,
            () => uploads
          )

        // Files removed from the public directory are deleted from S3.
        const oldFiles = Object.keys(oldHashes).filter(name => !hashes[name])
        if (oldFiles.length)
          await ctx.logPlan(
            `delete ${plural(oldFiles.length, 'old public file')}`,
            createRetryable({
              shouldRetry,
              delay(tries) {
                const delaySecs = Math.pow(2, tries)
                ctx.logActivity(
                  'retrying deleteObjects call in %d seconds (attempt %d)',
                  delaySecs,
                  tries
                )
                return delaySecs
              },
              action: () =>
                S3.deleteObjects(config.region)({
                  delete: {
                    objects: oldFiles.map(key => ({ key })),
                  },
                  bucket: buckets.publicDir,
                  creds: secrets,
                }),
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

interface Uploader extends PromiseLike<any[]> {
  add(name: string, upload: () => Promise<any>): void
  readonly length: number
}

function createUploader(ctx: DeployContext): Uploader {
  const uploads: Promise<any>[] = []
  const startUpload = createRetryable({
    action(_name: string, upload: () => Promise<any>) {
      const uploading = upload()
      if (this.tries == 1) {
        uploads.push(uploading)
      }
      return uploading
    },
    shouldRetry,
    delay(tries, name) {
      const delaySecs = Math.pow(2, tries)
      ctx.logActivity(
        'retrying upload of "%s" in %d seconds (attempt %d)',
        name,
        delaySecs,
        tries
      )
      return delaySecs
    },
  })

  return {
    add: startUpload,
    get length() {
      return uploads.length
    },
    then: (f, r) => Promise.all(uploads).then(f, r),
  }
}

function shouldRetry(e: any) {
  // Connection closed by Amazon S3.
  return e.message.includes('EPIPE')
}

// https://github.com/microsoft/TypeScript/issues/14829#issuecomment-504042546
type NoInfer<T> = [T][T extends any ? 0 : never]

function createRetryable<Args extends any[]>({
  action,
  maxRetries = 3,
  shouldRetry,
  delay: getDelay,
}: {
  action: (this: { tries: number }, ...args: Args) => Promise<any>
  maxRetries?: number
  shouldRetry: (e: any) => boolean
  delay: (tries: number, ...args: NoInfer<Args>) => number
}) {
  return (...args: Args) => {
    const retry = (tries: number) => {
      return action.call({ tries }, ...args).catch(e => {
        if (tries <= maxRetries && shouldRetry(e)) {
          const delay = getDelay(tries, ...args)
          return new Promise(resolve => {
            setTimeout(() => {
              resolve(retry(tries + 1))
            }, delay * 1e3)
          })
        }
        throw e
      })
    }
    return retry(1)
  }
}
