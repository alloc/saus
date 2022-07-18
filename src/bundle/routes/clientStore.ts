import { bundleDir } from '@/paths'
import { injectRoutes } from '@/virtualRoutes'
import { resolve } from 'path'
import { BundleContext } from '../context'

export function injectClientStoreRoute(context: BundleContext) {
  injectRoutes(context, [
    {
      path: '/*',
      plugin: resolve(bundleDir, '../routes/clientStorePlugin.ts'),
    },
  ])
}
