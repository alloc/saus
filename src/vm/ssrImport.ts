import { SausContext } from '../core'
import { createAsyncRequire, RequireAsyncConfig } from './asyncRequire'
import { compileSsrModule } from './compileSsrModule'
import { dedupeNodeResolve } from './dedupeNodeResolve'

export type SsrImportOptions = Omit<
  RequireAsyncConfig,
  'nodeResolve' | 'isCompiledModule' | 'compileModule'
>

export function createSsrImport(
  context: SausContext,
  options?: SsrImportOptions
) {
  const { root, resolve } = context.config
  return createAsyncRequire({
    ...options,
    nodeResolve: resolve.dedupe && dedupeNodeResolve(root, resolve.dedupe),
    isCompiledModule: id =>
      !id.includes('/node_modules/') && id.startsWith(root + '/'),
    compileModule(id) {
      return compileSsrModule(id, context)
    },
  })
}
