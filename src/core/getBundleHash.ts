import { BundleOptions } from '../bundle/options'
import { md5Hex } from './utils/md5-hex'
import { pick, pickAllExcept } from './utils/pick'
import { BundleConfig } from './vite'

export function getBundleHash(
  mode: string,
  config: BundleConfig,
  bundleOptions: BundleOptions
) {
  const values = {
    mode,
    ...pick(config, ['type', 'entry', 'target', 'format', 'clientStore']),
    bundle: pickAllExcept(bundleOptions, [
      'appVersion',
      'forceWriteAssets',
      'onPublicFile',
      'publicDirMode',
    ]),
  }
  return md5Hex(JSON.stringify(values)).slice(0, 8)
}
