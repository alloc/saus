import { defer, Deferred } from '../utils/defer'
import { noop } from '../utils/noop'
import { plural } from '../utils/plural'
import { compileSsrModule } from '../vm/compileSsrModule'
import { debug } from '../vm/debug'
import { executeModule } from '../vm/executeModule'
import { formatAsyncStack } from '../vm/formatAsyncStack'
import { registerModuleOnceCompiled } from '../vm/moduleMap'
import { ModuleMap } from '../vm/types'
import { SausContext } from './context'
import { setRenderModule } from './global'

let loading: Deferred<void> | null = null

export async function loadRenderers(context: SausContext) {
  // Both a page request and the file watcher will trigger
  // this function, so we have to account for parallel calls.
  if (loading) return loading.promise
  loading = defer<void>()
  loading.promise.catch(noop)

  const time = Date.now()
  const moduleMap = context.moduleMap || {}

  const renderModule =
    moduleMap[context.renderPath] ||
    (await compileRenderModule(context, moduleMap))

  const renderConfig = setRenderModule({
    beforeRenderHooks: [],
    defaultRenderer: undefined,
    renderers: [],
  })
  try {
    await executeModule(renderModule)
    Object.assign(context, renderConfig)
    debug(
      `Loaded ${plural(
        context.renderers.length + (context.defaultRenderer ? 1 : 0),
        'renderer'
      )} in ${Date.now() - time}ms`
    )
    loading.resolve()
  } catch (error: any) {
    formatAsyncStack(error, moduleMap, [], context.config.filterStack)
    loading.reject(error)
    throw error
  } finally {
    setRenderModule(null)
    loading = null
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
