import { httpImport } from '@runtime/http/httpImport'
import { jsonImport } from '@runtime/http/jsonImport'
import { createAsyncRequire, RequireAsyncConfig } from '@vm/asyncRequire'
import { dedupeNodeResolve } from '@vm/dedupeNodeResolve'
import { RequireAsync } from '@vm/types'
import fs from 'fs'
import { SausContext, SausEventEmitter } from './context'
import { compileNodeModule } from './vite/compileNodeModule'
import { compileSsrModule } from './vite/compileSsrModule'

export function getRequireFunctions(context: SausContext): {
  require: RequireAsync
  ssrRequire: RequireAsync
} {
  const {
    config,
    externalExports,
    linkedModules,
    liveModulePaths,
    moduleMap,
    root,
    watcher,
    resolveId,
  } = context

  const nodeResolve =
    config.resolve.dedupe && dedupeNodeResolve(root, config.resolve.dedupe)

  const isLiveModule =
    liveModulePaths &&
    ((id: string) => {
      return liveModulePaths.has(id)
    })

  const isCompiledModule = (id: string) =>
    !id.includes('/node_modules/') && id.startsWith(root + '/')

  const onModuleLoaded: RequireAsyncConfig['onModuleLoaded'] = (...args) =>
    (context.events as SausEventEmitter).emit('require', ...args)

  const watchFile = watcher?.add.bind(watcher)
  const filterStack = config.filterStack
  const timeout = config.saus.requireTimeout

  return {
    ssrRequire: createAsyncRequire({
      resolveId,
      moduleMap,
      linkedModules,
      isLiveModule,
      externalExports,
      nodeResolve,
      watchFile,
      httpImport,
      jsonImport,
      timeout,
      filterStack,
      onModuleLoaded,
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
      httpImport,
      jsonImport,
      timeout,
      filterStack,
      onModuleLoaded,
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
        return compileSsrModule(id, context, virtualId, /* isHybrid */ true)
      },
      get shouldReload() {
        return context.ssrForceReload
      },
    }),
  }
}
