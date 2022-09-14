import { __exportFrom as exportFrom } from '@/node/esmInterop'
import { exportsId } from '@/vm/compileEsm'

export function injectExportFrom(env: Record<string, any>) {
  const forwardedExports: any[] = []
  env[exportsId] = exportFrom(env[exportsId], forwardedExports)
  env[exportFrom.name] = function exportFrom(imported: any) {
    forwardedExports.unshift(imported)
  }
}
