import { loadBundle, LoadBundleConfig } from '@/loadBundle'
import { bumpAppVersion } from './bump'
import { onDeploy } from './hooks'

/**
 * Prepare the Saus SSR bundle for deployment.
 *
 * This function calls `onDeploy` so you don't have to. It also calls
 * the `bumpAppVersion` function, but only if the bundle isn't cached.
 */
export function prepareBundle(config?: LoadBundleConfig) {
  return onDeploy(() =>
    loadBundle({
      ...config,
      bundle: {
        publicDirMode: 'cache',
        ...config?.bundle,
      },
      async onBundleStart(options) {
        const bump = await bumpAppVersion()
        if (bump.type) {
          options.appVersion = bump.version
        }
      },
    })
  )
}
