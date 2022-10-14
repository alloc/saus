import { loadContext } from '@/context'
import { vite } from '@/vite'
import { prependBase } from '@utils/base'
import { noop } from '@utils/noop'
import { PreviewOptions } from './options'

export async function startPreviewServer(preview: PreviewOptions) {
  const { config, defaultPath } = await loadContext('build', {
    config: { preview },
  })

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
