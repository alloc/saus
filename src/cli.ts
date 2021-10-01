import 'source-map-support/register'
import cac from 'cac'

const cli = cac('stite')

cli.command('dev').action(async () => {
  const { createServer } = require('./dev') as typeof import('./dev/index')
  await createServer()
})

export default cli
