import { loadContext } from '../core/context'
import { prependBase } from '../core/utils/base'
import { noop } from '../core/utils/noop'
import { vite } from '../core/vite'
import { PreviewOptions } from './options'

export async function startPreviewServer(preview: PreviewOptions) {
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
