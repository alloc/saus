import { loadContext } from './core/context'
import { vite } from './core/vite'
import { noop } from './utils/noop'
import { prependBase } from './utils/prependBase'

export interface InlinePreviewConfig {
  host?: string | boolean
  https?: boolean
  open?: boolean | string
  port?: number
  strictPort?: boolean
}

export async function startPreviewServer(preview: InlinePreviewConfig) {
  const { config, defaultPath } = await loadContext('build', { preview })
  const bundleConfig = config.saus.bundle!

  const debugBase =
    bundleConfig.debugBase && prependBase(bundleConfig.debugBase, config.base)

  config.preview.fallback = function (req, res) {
    if (!req.url) return

    const base =
      debugBase && req.url.startsWith(debugBase) ? debugBase : config.base

    if (req.url.replace(base, '/') == defaultPath) {
      return (res.statusCode = 404), res.end()
    }

    req.url = prependBase(defaultPath, base)
    this.handle(req, res, noop)
  }

  return vite.preview(config as any)
}
