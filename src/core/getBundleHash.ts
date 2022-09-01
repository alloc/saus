import { BundleOptions } from '../bundle/options'
import { murmurHash } from './utils/murmur3'
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
  return murmurHash(JSON.stringify(values))
}
