import * as esModuleLexer from 'es-module-lexer'
import fs from 'fs'
import MagicString from 'magic-string'
import { createAsyncRequire, updateModuleMap } from '../vm/asyncRequire'
import { compileNodeModule } from '../vm/compileNodeModule'
import { compileSsrModule } from '../vm/compileSsrModule'
import { executeModule } from '../vm/executeModule'
import { formatAsyncStack } from '../vm/formatAsyncStack'
import { ModuleMap, ResolveIdHook } from '../vm/types'
import { SausContext } from './context'
import { debug } from './debug'
import { setRoutesModule } from './global'

type LoadOptions = {
  moduleMap?: ModuleMap
  resolveId?: ResolveIdHook
}

export async function loadRoutes(context: SausContext, options: LoadOptions) {
  const time = Date.now()
  const { moduleMap = {}, resolveId = () => undefined } = options

  context.compileCache.locked = true
  const routesModule = await compileRoutesModule(context, moduleMap, resolveId)
  const routesConfig = setRoutesModule({
    routes: [],
    runtimeHooks: [],
    defaultState: [],
  })
  try {
    await executeModule(routesModule)
    context.compileCache.locked = false
    Object.assign(context, routesConfig)
    debug(`Loaded the routes module in ${Date.now() - time}ms`)
  } catch (error: any) {
    formatAsyncStack(error, moduleMap, [])
    throw error
  } finally {
    setRoutesModule(null)
  }
}

async function compileRoutesModule(
  context: SausContext,
  moduleMap: ModuleMap,
  resolveId: ResolveIdHook
) {
  const { routesPath, root } = context

  // Import specifiers for route modules need to be rewritten
  // as dev URLs for them to be imported properly by the browser.
  const code = fs.readFileSync(routesPath, 'utf8')
  const editor = new MagicString(code)
  for (const imp of esModuleLexer.parse(code)[0]) {
    if (imp.d >= 0 && imp.n) {
      const resolvedId = await resolveId(imp.n, routesPath)
      if (resolvedId) {
        const resolvedUrl = resolvedId.startsWith(root + '/')
          ? resolvedId.slice(root.length)
          : '/@fs/' + resolvedId

        editor.overwrite(imp.s, imp.e, `"${resolvedUrl}"`)
      }
    }
  }

  const isProjectFile = (id: string) =>
    !id.includes('/node_modules/') && id.startsWith(root + '/')

  const require = createAsyncRequire({
    moduleMap,
    resolveId,
    isCompiledModule: id => /\.m?[tj]sx?$/.test(id) && isProjectFile(id),
    // Vite plugins are skipped by the Node pipeline.
    compileModule: async (id, require) => {
      const code = fs.readFileSync(id, 'utf8')
      return compileNodeModule(code, id, context, require)
    },
  })

  const ssrRequire = createAsyncRequire({
    moduleMap,
    resolveId,
    isCompiledModule: isProjectFile,
    compileModule: (id, ssrRequire) =>
      compileSsrModule(id, context, ssrRequire),
  })

  const modulePromise = compileNodeModule(
    editor.toString(),
    routesPath,
    context,
    (id, importer, isDynamic) =>
      isDynamic ? ssrRequire(id, importer, true) : require(id, importer, false)
  )

  updateModuleMap(moduleMap, modulePromise)
  return modulePromise
}
