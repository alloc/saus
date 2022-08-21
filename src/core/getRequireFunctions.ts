import fs from 'fs'
import { SausContext } from './context'
import { compileNodeModule } from './vite/compileNodeModule'
import { compileSsrModule } from './vite/compileSsrModule'
import { createAsyncRequire } from './vm/asyncRequire'
import { dedupeNodeResolve } from './vm/dedupeNodeResolve'
import { ResolveIdHook } from './vm/types'

export function getRequireFunctions(context: SausContext) {
  const {
    config,
    externalExports,
    linkedModules,
    liveModulePaths,
    moduleMap,
    root,
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
  const timeout = config.saus.requireTimeout ?? 10

  return {
    ssrRequire: createAsyncRequire({
      resolveId,
      moduleMap,
      linkedModules,
      isLiveModule,
      externalExports,
      nodeResolve,
      watchFile,
      timeout,
      filterStack,
      isCompiledModule,
      compileModule(id, _, virtualId) {
        return compileSsrModule(id, context, virtualId)
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
      timeout,
      filterStack,
      isCompiledModule,
      async compileModule(id, require, virtualId) {
        const isNodeModule =
          !virtualId && (id.includes('/node_modules/') || !id.startsWith(root))
        if (isNodeModule) {
          return compileNodeModule(
            fs.readFileSync(id, 'utf8'),
            id,
            require,
            context
          )
        }
        return compileSsrModule(id, context, virtualId)
      },
      get shouldReload() {
        return context.ssrForceReload
      },
    }),
  }
}
