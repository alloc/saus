import 'source-map-support/register'
import { success } from 'misty'
import color from 'kleur'
import cac from 'cac'
import * as vite from 'vite'

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

cli.command('build').action(async () => {
  const { build } = require('./build') as typeof import('./build')
  const { pages, errors } = await build()
  for (const error of errors) {
    console.log('')
    console.error(color.red(`Failed to render`), error.path)
    console.error(`  ` + color.gray(error.reason))
  }
  console.log('')
  success(`${pages.length} pages rendered!`)
  process.exit(errors.length ? 1 : 0)
})

cli.help()
cli.version(require('../package.json').version)

export default cli
