import { loadContext } from './core/context'
import { vite } from './core/vite'

export interface InlinePreviewConfig {
  host?: string | boolean
  https?: boolean
  open?: boolean | string
  port?: number
  strictPort?: boolean
}

export async function startPreviewServer(preview: InlinePreviewConfig) {
  const { config } = await loadContext('build', { preview })
  return vite.preview(config as any)
}
