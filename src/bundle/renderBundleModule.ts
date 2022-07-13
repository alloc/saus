import { endent, serializeImports } from '@/core'
import { InjectedImports } from '@/injectModules'
import { bundleDir } from '@/paths'
import path from 'path'

export function renderBundleModule(
  routesPath: string,
  imports: InjectedImports
) {
  const runtimeId = path.join(bundleDir, 'bundle/api.ts')
  const runtimeConfigId = path.join(bundleDir, 'bundle/config.ts')
  return endent`
    ${serializeImports(imports.prepend).join('\n')}
    import "${routesPath}"
    ${serializeImports(imports.append).join('\n')}

    export * from "${runtimeId}"
    export { default } from "${runtimeId}"
    export { default as config } from "${runtimeConfigId}"
  `
}
