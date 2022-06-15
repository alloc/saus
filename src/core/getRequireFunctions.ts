import fs from 'fs'
import { createAsyncRequire } from '../vm/asyncRequire'
import { compileNodeModule } from '../vm/compileNodeModule'
import { compileSsrModule } from '../vm/compileSsrModule'
import { dedupeNodeResolve } from '../vm/dedupeNodeResolve'
import { SausContext } from './context'

export function getRequireFunctions(
  context: Omit<SausContext, 'command'>,
  resolveId = context.resolveId!,
  moduleMap = context.moduleMap || {}
) {
  const {
    root,
    config,
    compileCache,
    externalExports,
    linkedModules,
    liveModulePaths,
    watcher,
  } = context

  const nodeResolve =
    config.resolve.dedupe && dedupeNodeResolve(root, config.resolve.dedupe)

  const isLiveModule =
    liveModulePaths && ((id: string) => liveModulePaths.has(id))

  const isCompiledModule = (id: string) =>
    !id.includes('/node_modules/') && id.startsWith(root + '/')

  const watchFile = watcher && watcher.add.bind(watcher)
  const filterStack = config.filterStack

  return {
    ssrRequire: createAsyncRequire({
      resolveId,
      moduleMap,
      linkedModules,
      isLiveModule,
      externalExports,
      nodeResolve,
      watchFile,
      filterStack,
      isCompiledModule,
      compileModule(id) {
        return compileSsrModule(id, context)
      },
      get shouldReload() {
        return context.ssrForceReload
      },
    }),
    require: createAsyncRequire({
      resolveId,
      moduleMap,
      linkedModules,
      isLiveModule,
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
      get shouldReload() {
        return context.ssrForceReload
      },
    }),
  }
}
