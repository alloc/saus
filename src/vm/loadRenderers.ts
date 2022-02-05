import { SausContext } from '../core/context'
import { debug } from '../core/debug'
import { setRenderModule } from '../core/global'
import { plural } from '../utils/plural'
import { createAsyncRequire, updateModuleMap } from './asyncRequire'
import { compileSsrModule } from './compileSsrModule'
import { dedupeNodeResolve } from './dedupeNodeResolve'
import { executeModule } from './executeModule'
import { formatAsyncStack } from './formatAsyncStack'
import { ModuleMap, RequireAsync, ResolveIdHook } from './types'

type LoadOptions = {
  moduleMap?: ModuleMap
  resolveId?: ResolveIdHook
}

export async function loadRenderers(
  context: SausContext,
  options: LoadOptions
) {
  const time = Date.now()
  const { moduleMap = {}, resolveId = () => undefined } = options
  const { dedupe } = context.config.resolve

  const ssrRequire = createAsyncRequire({
    moduleMap,
    resolveId,
    nodeResolve: dedupe && dedupeNodeResolve(context.root, dedupe),
    isCompiledModule: id =>
      !id.includes('/node_modules/') && id.startsWith(context.root + '/'),
    compileModule: (id, ssrRequire) =>
      compileSsrModule(id, context, ssrRequire),
  })

  context.compileCache.locked = true
  const renderModule = await compileRenderModule(context, ssrRequire, moduleMap)
  const renderConfig = setRenderModule({
    renderers: [],
    beforeRenderHooks: [],
  })
  try {
    await executeModule(renderModule)
    context.compileCache.locked = false
    Object.assign(context, renderConfig)
    const rendererCount =
      context.renderers.length + (context.defaultRenderer ? 1 : 0)
    debug(
      `Loaded ${plural(rendererCount, 'renderer')} in ${Date.now() - time}ms`
    )
  } catch (error: any) {
    formatAsyncStack(error, moduleMap, [], context.config.filterStack)
    throw error
  } finally {
    setRenderModule(null)
  }
}

function compileRenderModule(
  context: SausContext,
  ssrRequire: RequireAsync,
  moduleMap: ModuleMap
) {
  const modulePromise = compileSsrModule(
    context.renderPath,
    context,
    ssrRequire
  ).then(module => {
    if (!module) {
      throw Error(`Cannot find module '${context.renderPath}'`)
    }
    return module
  })
  updateModuleMap(moduleMap, modulePromise)
  return modulePromise
}
