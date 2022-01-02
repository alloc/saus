import 'source-map-support/register'
import { success } from 'misty'
import color from 'kleur'
import cac from 'cac'
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
  .option(
    '--minify [minifier]',
    `[boolean | "terser" | "esbuild"] enable/disable minification, ` +
      `or specify minifier to use (default: esbuild)`
  )
  .option('--force', `[boolean] clear the rollup cache`)
  .option('-w, --maxWorkers [count]', `[number] set to zero to disable workers`)
  .action(async (options: BuildOptions) => {
    const { build } = require('./build') as typeof import('./build')
    const { pages, errors } = await build({ build: options })
    if (errors.length) {
      console.log('')
      for (const error of errors) {
        console.error(color.red(`Failed to render`), error.path)
        console.error(`  ` + color.gray(error.reason))
        console.log('')
      }
    }
    success(`${pages.length} pages rendered.`)
    process.exit(errors.length ? 1 : 0)
  })

cli
  .command('bundle [outFile]')
  .option(
    '--mode <mode>',
    `[string] override the client mode (eg: development)`
  )
  .option('--minify', `[boolean] minify the client modules`)
  .action(async (outFile, options) => {
    options.outFile = outFile
    await (require('./bundle') as typeof import('./bundle')).bundle(options)
  })

cli.help()
cli.version(require('../package.json').version)

export default cli
