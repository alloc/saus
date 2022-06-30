import { relativeToCwd } from '@/node/relativeToCwd'
import type { vite } from '@/vite'
import { green } from 'kleur/colors'
import type { BundleOptions, InlineBundleConfig } from '../../bundle'
import { command } from '../command'

command(bundle, '[outFile]')
  .option('--load', `[boolean] check local cache before bundling`)
  .option(
    '--mode <mode>',
    `[string] override the client mode (eg: development)`
  )
  .option('--entry [file]', `[string|boolean] set the bundle entry`)
  .option('--minify', `[boolean] minify the client modules`)
  .option('--sourcemap', `[boolean] enable/disable source maps`)

export type BundleFlags = InlineBundleConfig & {
  load?: boolean
  minify?: boolean
  mode?: string
  sourcemap?: boolean | 'inline' | 'hidden'
}

export async function bundle(outFile: string, options: BundleFlags) {
  const viteOptions: vite.InlineConfig = {
    mode: options.mode,
    build: { sourcemap: options.sourcemap },
  }

  const bundleOptions: BundleOptions = {
    minify: options.minify,
  }

  if (options.load) {
    const { loadBundle } = await import('../../core')
    const {
      cached,
      bundlePath,
      context: { logger },
    } = await loadBundle({
      config: viteOptions,
      bundle: bundleOptions,
      write: false,
    })
    logger.info(
      green('✔︎') +
        (cached
          ? ' Bundle is already up-to-date.'
          : ' Bundle saved to: ' + relativeToCwd(bundlePath))
    )
  } else {
    const noWrite = !process.stdout.isTTY && !process.env.CI
    if (noWrite) {
      options.write = false
    }

    options.outFile = outFile
    viteOptions.logLevel = noWrite ? 'silent' : undefined

    const { bundle } = await import('../../bundle/api')
    const { loadBundleContext } = await import('../../bundle/context')

    const context = await loadBundleContext(options, viteOptions)
    let { code, map } = await bundle(context, bundleOptions)

    if (noWrite) {
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
