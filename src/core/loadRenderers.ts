import { plural } from '../utils/plural'
import { createAsyncRequire } from '../vm/asyncRequire'
import { compileSsrModule } from '../vm/compileSsrModule'
import { executeModule } from '../vm/executeModule'
import { formatAsyncStack } from '../vm/formatAsyncStack'
import { ModuleMap, ResolveIdHook } from '../vm/types'
import { SausContext } from './context'
import { debug } from './debug'
import { setRenderModule } from './global'

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

  const ssrRequire = createAsyncRequire({
    moduleMap,
    resolveId,
    isCompiledModule: id =>
      !id.includes('/node_modules/') && id.startsWith(context.root + '/'),
    compileModule: (id, ssrRequire) =>
      compileSsrModule(id, context, ssrRequire),
  })

  context.compileCache.locked = true
  const entryModule = await compileSsrModule(
    context.renderPath,
    context,
    ssrRequire
  )
  if (!entryModule) {
    throw Error(`Cannot find module '${context.renderPath}'`)
  }
  const renderConfig = setRenderModule({
    renderers: [],
    beforeRenderHooks: [],
  })
  try {
    await executeModule(entryModule)
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
