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

type BuildFlags = BuildOptions & {
  debug?: boolean
}

cli
  .command('build [bundlePath]')
  .option('-w, --maxWorkers [count]', `[number] set to zero to disable workers`)
  .option('--cached', `[boolean] use the most recent build`)
  .option('--debug', `[boolean] rebuild pages that failed the last run`)
  .option('--minify', `[boolean] minify the client modules`)
  .option('--outDir <dir>', `[string] output directory (default: dist)`)
  .option(
    '--emptyOutDir',
    `[boolean] force empty outDir when it's outside of root`
  )
  .action(async (bundlePath: string, options: BuildFlags) => {
    const { build } = require('./build') as typeof import('./build')
    const { getFailedPages, setFailedPages } =
      require('./build/failedPages') as typeof import('./build/failedPages')

    try {
      if (options.debug) {
        const failedPages = getFailedPages()
        options.skip = pagePath => !failedPages.includes(pagePath)
      }
      options.bundlePath = bundlePath
      const { pages, errors } = await build(options)
      const failedPages: string[] = []
      if (errors.length) {
        log('')
        for (const error of errors) {
          failedPages.push(error.path)
          log.error(red(`Failed to render`), error.path)
          log.error(`  ` + gray(error.reason))
          log('')
        }
      }
      setFailedPages(failedPages)
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

    const { bundle } = require('./bundle') as typeof import('./bundle')
    const { loadBundleContext } =
      require('./core/bundle/context') as typeof import('./core/bundle/context')

    try {
      const context = await loadBundleContext(options, {
        mode: options.mode,
        logLevel: noWrite ? 'silent' : undefined,
        build: { sourcemap: options.sourcemap },
      })
      let { code, map } = await bundle(options, context)
      if (noWrite) {
        if (map) {
          const { toInlineSourceMap } =
            require('./utils/sourceMap') as typeof import('./utils/sourceMap')

          code += toInlineSourceMap(map)
        }
        process.stdout.write(code)
      }
      // Shamefully force exit since something unknown is keeping us alive.
      process.exit(0)
    } catch (e: any) {
      if (e.message.startsWith('[saus]')) {
        fatal(e.message)
      }
      throw e
    }
  })

cli.command('test').action(async () => {
  const { startTestServer } = require('./test') as typeof import('./test')
  await startTestServer()
})

cli.help()
cli.version(require('../package.json').version)

export default cli
