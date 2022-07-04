import fs from 'fs'
import { SausContext } from './context'
import { compileNodeModule } from './vite/compileNodeModule'
import { compileSsrModule } from './vite/compileSsrModule'
import { createAsyncRequire } from './vm/asyncRequire'
import { dedupeNodeResolve } from './vm/dedupeNodeResolve'
import { ResolveIdHook } from './vm/types'

export function getRequireFunctions(context: SausContext) {
  const {
    root,
    config,
    compileCache,
    externalExports,
    linkedModules,
    liveModulePaths,
    moduleMap,
    watcher,
  } = context

  const resolveId: ResolveIdHook = async (id, importer) => {
    const resolved = await context.resolveId(id, importer)
    if (resolved) {
      return typeof resolved == 'string' ? { id: resolved } : resolved
    }
  }

  const nodeResolve =
    config.resolve.dedupe && dedupeNodeResolve(root, config.resolve.dedupe)

  const isLiveModule =
    liveModulePaths &&
    ((id: string) => {
      return liveModulePaths.has(id)
    })

  const isCompiledModule = (id: string) =>
    !id.includes('/node_modules/') && id.startsWith(root + '/')

  const watchFile = watcher?.add.bind(watcher)
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
