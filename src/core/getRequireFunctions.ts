import fs from 'fs'
import { createAsyncRequire } from '../vm/asyncRequire'
import { compileNodeModule } from '../vm/compileNodeModule'
import { compileSsrModule } from '../vm/compileSsrModule'
import { dedupeNodeResolve } from '../vm/dedupeNodeResolve'
import { ResolveIdHook } from '../vm/types'
import { SausContext } from './context'

export function getRequireFunctions(
  context: SausContext,
  resolveId: ResolveIdHook,
  moduleMap = context.server?.moduleMap || {}
) {
  const { root, config, compileCache } = context
  const linkedModules = context.server?.linkedModules
  const externalExports = context.server?.externalExports
  const filterStack = context.config.filterStack

  const nodeResolve =
    config.resolve.dedupe && dedupeNodeResolve(root, config.resolve.dedupe)

  const isCompiledModule = (id: string) =>
    !id.includes('/node_modules/') && id.startsWith(root + '/')

  const watcher = context.config.command == 'serve' && context.server!.watcher
  const watchFile = watcher ? watcher.add.bind(watcher) : undefined

  return {
    ssrRequire: createAsyncRequire({
      resolveId,
      moduleMap,
      linkedModules,
      externalExports,
      nodeResolve,
      watchFile,
      filterStack,
      isCompiledModule,
      compileModule(id) {
        return compileSsrModule(id, context)
      },
    }),
    require: createAsyncRequire({
      resolveId,
      moduleMap,
      linkedModules,
      externalExports,
      nodeResolve,
      watchFile,
      filterStack,
      isCompiledModule,
      async compileModule(id, require, virtualId) {
        if (virtualId) {
          return compileSsrModule(id, context)
        }
        // Vite plugins are skipped by the Node pipeline,
        // except for their `resolveId` hooks.
        return compileNodeModule(
          fs.readFileSync(id, 'utf8'),
          id,
          require,
          compileCache,
          config.env
        )
      },
    }),
  }
}
