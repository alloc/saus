import { plural } from '../utils/plural'
import { compileSsrModule } from '../vm/compileSsrModule'
import { executeModule } from '../vm/executeModule'
import { formatAsyncStack } from '../vm/formatAsyncStack'
import { registerModuleOnceCompiled } from '../vm/moduleMap'
import { ModuleMap } from '../vm/types'
import { SausContext } from './context'
import { debug } from './debug'
import { setRenderModule } from './global'

export async function loadRenderers(context: SausContext) {
  const time = Date.now()
  const moduleMap = context.server?.moduleMap || {}

  context.compileCache.locked = true
  const renderModule =
    moduleMap[context.renderPath] ||
    (await compileRenderModule(context, moduleMap))

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

function compileRenderModule(context: SausContext, moduleMap: ModuleMap) {
  return registerModuleOnceCompiled(
    moduleMap,
    compileSsrModule(context.renderPath, context).then(module => {
      if (!module) {
        throw Error(`Cannot find module '${context.renderPath}'`)
      }
      return module
    })
  )
}
