import { endent, serializeImports } from '@/core'
import { bundleDir } from '@/paths'
import path from 'path'

export function renderBundleModule(
  routesPath: string,
  pluginImports: Set<string>
) {
  const runtimeId = path.join(bundleDir, 'bundle/api.ts')
  const runtimeConfigId = path.join(bundleDir, 'bundle/config.ts')
  return endent`
    ${serializeImports(Array.from(pluginImports))}
    import "${routesPath}"

    export * from "${runtimeId}"
    export { default } from "${runtimeId}"
    export { default as config } from "${runtimeConfigId}"
  `
}
