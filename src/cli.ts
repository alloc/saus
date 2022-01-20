import 'source-map-support/register'
import cac from 'cac'
import { red, gray } from 'kleur/colors'
import { fatal, success } from 'misty'
import log from 'shared-log'
import { BuildOptions, vite } from './core'

const cli = cac('saus')

cli
  .command('dev')
  .option('--host [host]', `[string] specify hostname`)
  .option('--port <port>', `[number] specify port`)
  .option('--open [path]', `[boolean | string] open browser on startup`)
  .option('--strictPort', `[boolean] exit if specified port is already in use`)
  .option(
    '--force',
    `[boolean] force the optimizer to ignore the cache and re-bundle`
  )
  .action(async (options: vite.ServerOptions) => {
    const { createServer } = require('./dev') as typeof import('./dev')
    await createServer({ server: options })
  })

cli
  .command('build')
  .option('-w, --maxWorkers [count]', `[number] set to zero to disable workers`)
  .option('--minify', `[boolean] minify the client modules`)
  .option('--outDir <dir>', `[string] output directory (default: dist)`)
  .option(
    '--emptyOutDir',
    `[boolean] force empty outDir when it's outside of root`
  )
  .action(async (options: BuildOptions) => {
    const { build } = require('./build') as typeof import('./build')
    try {
      const { pages, errors } = await build({ build: options })
      if (errors.length) {
        log('')
        for (const error of errors) {
          log.error(red(`Failed to render`), error.path)
          log.error(`  ` + gray(error.reason))
          log('')
        }
      }
      success(`${pages.length} pages rendered.`)
      process.exit(errors.length ? 1 : 0)
    } catch (e: any) {
      if (e.message.startsWith('[saus]')) {
        fatal(e.message)
      }
      throw e
    }
  })

cli
  .command('bundle [outFile]')
  .option(
    '--mode <mode>',
    `[string] override the client mode (eg: development)`
  )
  .option('--minify', `[boolean] minify the client modules`)
  .option('--sourcemap', `[boolean] enable/disable source maps`)
  .action(async (outFile, options) => {
    options.outFile = outFile

    const noWrite = !process.stdout.isTTY && !process.env.CI
    if (noWrite) {
      options.write = false
    }

    const { bundle, loadBundleContext } =
      require('./bundle') as typeof import('./bundle')

    const context = await loadBundleContext({
      mode: options.mode,
      logLevel: noWrite ? 'silent' : undefined,
      build: { sourcemap: options.sourcemap },
    })

    try {
      let { code, map } = await bundle(context, options)
      if (noWrite) {
        if (map) {
          const { toInlineSourceMap } =
            require('./bundle/sourceMap') as typeof import('./bundle/sourceMap')
          code += toInlineSourceMap(map)
        }
        process.stdout.write(code)
      }
    } catch (e: any) {
      if (e.message.startsWith('[saus]')) {
        fatal(e.message)
      }
      throw e
    }
  })

cli.help()
cli.version(require('../package.json').version)

export default cli
