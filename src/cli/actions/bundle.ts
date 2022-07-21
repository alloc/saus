import { relativeToCwd } from '@/node/relativeToCwd'
import type { vite } from '@/vite'
import { green } from 'kleur/colors'
import type { BundleOptions, InlineBundleConfig } from '../../bundle'
import { command } from '../command'

command(bundle, '[outFile]')
  .option('--load', `[boolean] check local cache before bundling`)
  .option('--reload', `[boolean] clear local cache before bundling`)
  .option(
    '--mode <mode>',
    `[string] override the client mode (eg: development)`
  )
  .option(
    '--assetsDir <path>',
    `[string] override build.assetsDir and force-write chunks/assets`
  )
  .option('--entry [file]', `[string|boolean] set the bundle entry`)
  .option('--minify', `[boolean] minify the client modules`)
  .option('--sourcemap', `[boolean] enable/disable source maps`)
  .option('--stdout', `[boolean] write bundle to stdout`)
  .option('--appVersion <string>', `[string] set the app version`)

export type BundleFlags = InlineBundleConfig & {
  assetsDir?: string
  load?: boolean
  minify?: boolean
  mode?: string
  reload?: boolean
  sourcemap?: boolean | 'inline' | 'hidden'
  stdout?: boolean
}

export async function bundle(outFile: string, options: BundleFlags) {
  const viteOptions: vite.InlineConfig = {
    mode: options.mode,
    build: {
      assetsDir: options.assetsDir,
      sourcemap: options.sourcemap,
    },
  }

  const bundleOptions: BundleOptions = {
    appVersion: options.appVersion,
    forceWriteAssets: !!options.assetsDir,
    minify: options.minify,
  }

  if (options.load || options.reload) {
    const { loadBundle } = await import('../../core')
    const bundle = await loadBundle({
      config: viteOptions,
      bundle: bundleOptions,
      force: options.reload,
    })
    bundle.context.logger.info(
      green('✔︎') +
        (bundle.cached
          ? ' Bundle is already up-to-date.'
          : ' Bundle saved to: ' + relativeToCwd(bundle.cachePath))
    )
  } else {
    options.outFile = outFile

    // In TTY and CI contexts, --stdout defaults to false.
    // Specifying an outFile also defaults --stdout to false.
    const preferStdout = !outFile && !process.stdout.isTTY && !process.env.CI
    const writeToStdout = options.stdout ?? preferStdout
    if (writeToStdout) {
      // Disable write to disk.
      options.write = !preferStdout
      // Disable feedback logs.
      viteOptions.logLevel = 'silent'
    }

    const { bundle } = await import('../../bundle/api')
    const { loadBundleContext } = await import('../../bundle/context')

    const context = await loadBundleContext(options, viteOptions)
    let { code, map } = await bundle(context, bundleOptions)

    if (writeToStdout) {
      if (map) {
        const { toInlineSourceMap } = await import('../../core')
        code += toInlineSourceMap(map)
      }
      process.stdout.write(code)
    }

    // Shamefully force exit since something unknown is keeping us alive.
    process.exit(0)
  }
}
