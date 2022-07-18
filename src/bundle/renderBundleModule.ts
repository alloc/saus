import { endent } from '@/core'
import { bundleDir } from '@/paths'
import path from 'path'

export function renderBundleModule(ssrEntryId: string) {
  const runtimeId = path.join(bundleDir, 'bundle/api.ts')
  const runtimeConfigId = path.join(bundleDir, 'bundle/config.ts')
  return endent`
    import "${ssrEntryId}"

    export * from "${runtimeId}"
    export { default } from "${runtimeId}"
    export { default as config } from "${runtimeConfigId}"
  `
}
