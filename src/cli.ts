import 'source-map-support/register'
import { success } from 'misty'
import color from 'kleur'
import cac from 'cac'

const cli = cac('saus')

cli.command('dev').action(async () => {
  const { createServer } = require('./dev') as typeof import('./dev')
  await createServer()
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

export default cli
