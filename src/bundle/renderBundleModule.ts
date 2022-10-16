import { bundleDir } from '@/paths'
import endent from 'endent'
import path from 'path'

export function renderBundleModule(ssrEntryId: string) {
  const runtimeId = path.join(bundleDir, 'bundle/api.mjs')
  const runtimeConfigId = path.join(bundleDir, 'bundle/config.mjs')
  return endent`
    import "${ssrEntryId}"

    export * from "${runtimeId}"
    export { default } from "${runtimeId}"
    export { default as config } from "${runtimeConfigId}"
  `
}
