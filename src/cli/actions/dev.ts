import { vite } from '@/vite'
import { command } from '../command'

command(dev)
  .option('--host [host]', `[string] specify hostname`)
  .option('--port <port>', `[number] specify port`)
  .option('--open [path]', `[boolean | string] open browser on startup`)
  .option('--strictPort', `[boolean] exit if specified port is already in use`)
  .option(
    '--force',
    `[boolean] force the optimizer to ignore the cache and re-bundle`
  )

export async function dev(options: vite.ServerOptions) {
  const { createServer } = await import('../../dev/api')
  await createServer({ server: options })
}
