import { createRequestFn, secrets } from '@saus/cloudflare-request'
import path from 'path'
import { crawl } from 'recrawl-sync'
import { esbuild, esbuildViteBridge, md5Hex, plural } from 'saus/core'
import { defineDeployHook, DeployContext } from 'saus/deploy'
import { Props } from './types'

export default defineDeployHook(ctx => {
  const request = createRequestFn({
    apiToken: secrets.apiToken,
    logger: ctx.logger,
  })

  const toScriptName = (file: esbuild.OutputFile, baseDir: string) =>
    path.relative(baseDir, file.path).replace(/\.[jt]s$/, '')

  return {
    name: 'cloudflare/workers',
    async pull(props: Props) {
      const baseDir = path.resolve(ctx.root, props.baseDir)
      const entries = crawl(baseDir, {
        only: props.entries || ['*.ts'],
        skip: ['_*', 'node_modules', '.git'],
        absolute: true,
      }).map(entry => path.relative(ctx.root, entry))

      const files = await bundleWorkers(entries, props, ctx)
      return {
        workerHashes: files.map(file => md5Hex(file.text).slice(0, 16)),
        entries,
        files,
      }
    },
    ephemeral: ['files'],
    identify: target => ({
      zoneId: target.zoneId,
      route: target.route,
    }),
    // TODO: return rollback function
    spawn(target) {
      return ctx.logPlan(
        `deploy ${plural(target.entries.length, 'worker')} to Cloudflare`,
        async () => {
          const baseDir = path.resolve(ctx.root, target.baseDir)
          await Promise.all(
            target.files.map(async file => {
              const name = path
                .relative(baseDir, file.path)
                .replace(/\.[jt]s$/, '')

              await request(
                'put',
                `/accounts/${target.accountId}/workers/scripts/${name}`,
                {
                  headers: { 'Content-Type': 'application/javascript' },
                  body: { text: file.text },
                }
              )

              await request('post', `/zones/${target.zoneId}/workers/routes`, {
                body: {
                  json: {
                    pattern: target.route + name + '*',
                    script: name,
                  },
                },
              })
            })
          )
        }
      )
    },
    update(target, _, onRevert) {
      return this.spawn(target, onRevert)
    },
    async kill(target) {
      await Promise.all(
        target.files.map(async file => {
          await request(
            'delete',
            `/zones/${target.zoneId}/workers/scripts/${file.name}`
          )
        })
      )
    },
  }
})

async function bundleWorkers(
  entries: string[],
  props: Props,
  context: DeployContext
) {
  const baseDir = path.resolve(context.root, props.baseDir)
  const config = await context.resolveConfig({
    plugins: context.bundlePlugins,
  })

  const { outputFiles } = await esbuild.build({
    absWorkingDir: context.root,
    bundle: true,
    chunkNames: '_chunk.[hash]',
    entryNames: '[dir]/[name]',
    entryPoints: entries.map(entry => path.join(context.root, entry)),
    format: 'esm',
    logLevel: 'error',
    metafile: true,
    minify: props.minify,
    outbase: baseDir,
    outdir: baseDir,
    plugins: [await esbuildViteBridge(config)],
    sourcemap: 'external',
    splitting: false,
    target: 'es2020',
    treeShaking: true,
    write: false,
  })

  return outputFiles
}
