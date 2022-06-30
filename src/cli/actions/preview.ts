import type { PreviewOptions } from '../../preview/options'
import { command } from '../command'

command(preview)
  .option('--host [host]', `[string] specify hostname`)
  .option('--port <port>', `[number] specify port`)
  .option('--strictPort', `[boolean] exit if specified port is already in use`)
  .option('--https', `[boolean] use TLS + HTTP/2`)
  .option('--open [path]', `[boolean | string] open browser on startup`)

export async function preview(options: PreviewOptions) {
  const { startPreviewServer } = await import('../../preview/api')
  const server = await startPreviewServer(options)
  server.printUrls()
}
