import 'source-map-support/register'
import cac from 'cac'

const cli = cac('saus')

cli.command('dev').action(async () => {
  const { createServer } = require('./dev') as typeof import('./dev')
  await createServer()
})

export default cli
