import cac from 'cac'
import * as inspector from 'inspector'
import { commandActions } from './cli/actions'

declare const globalThis: any
if (inspector.url()) {
  globalThis.__inspectorActive = true
}

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
  .action(commandActions.dev)

cli
  .command('build [cacheDir]')
  .option('-w, --maxWorkers [count]', `[number] set to zero to disable workers`)
  .option('--force', `[boolean] rebundle instead of using cached bundle`)
  .option('--debug', `[boolean] rebuild pages that failed the last run`)
  .option('--filter <glob>', `[string] control which pages are rendered`)
  .option('--minify', `[boolean] minify the client modules`)
  .option(
    '--mode <mode>',
    `[string] override the client mode (eg: development)`
  )
  .option('--outDir <dir>', `[string] output directory (default: dist)`)
  .option(
    '--emptyOutDir',
    `[boolean] force empty outDir when it's outside of root`
  )
  .action(commandActions.build)

cli
  .command('bundle [outFile]')
  .option(
    '--mode <mode>',
    `[string] override the client mode (eg: development)`
  )
  .option('--entry [file]', `[string|boolean] set the bundle entry`)
  .option('--minify', `[boolean] minify the client modules`)
  .option('--sourcemap', `[boolean] enable/disable source maps`)
  .action(commandActions.bundle)

cli
  .command('preview')
  .option('--host [host]', `[string] specify hostname`)
  .option('--port <port>', `[number] specify port`)
  .option('--strictPort', `[boolean] exit if specified port is already in use`)
  .option('--https', `[boolean] use TLS + HTTP/2`)
  .option('--open [path]', `[boolean | string] open browser on startup`)
  .action(commandActions.preview)

cli
  .command('deploy')
  .option('--dry-run', `[boolean] generate deployment actions then bail out`)
  .action(commandActions.deploy)

cli
  .command('secrets add', 'Add secrets to use when deploying')
  .action(commandActions['secrets add'])

cli
  .command('secrets ls', 'List secrets used when deploying')
  .action(commandActions['secrets ls'])

cli.command('test').action(commandActions.test)

declare const __VERSION__: string

cli.help()
cli.version(__VERSION__)

export default cli
